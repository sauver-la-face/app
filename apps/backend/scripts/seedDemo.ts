/**
 * DEMO-01 — Jeu de données de démonstration du poste de travail chirurgien.
 *
 * Peuple la base avec quatre patients couvrant les quatre états du parcours de
 * suivi, de façon à ce que le tableau de bord (WEB-01) affiche réellement ce
 * qui est annoncé pendant la soutenance : des patients opérés, une alerte
 * critique (symptôme déclencheur) et une alerte d'inactivité (7 jours sans
 * synchronisation).
 *
 * Trois de ces patients portent en plus une chronologie photo (WEB-03) :
 * chaque cliché est réellement déposé dans le bucket MinIO, à la convention de
 * clé de `S3PhotoStorage`, pour que `GET /photos/:mediaId` les serve comme
 * celles remontées par le mobile.
 *
 * Idempotent : rejouable autant de fois que nécessaire. Chaque patient de
 * démonstration est retrouvé par son nom s'il existe déjà (aucun doublon), et
 * ses données cliniques sont reconstruites à partir d'UUID fixes.
 *
 * ATTENTION — le script efface les données cliniques (procédures, événements,
 * symptômes, instructions, codes) des quatre patients nommés ci-dessous avant
 * de les recréer. Il ne touche à aucun autre patient. Réservé au poste de
 * développement : refuse de s'exécuter si NODE_ENV vaut « production ».
 *
 * Usage :
 *   bun run --cwd apps/backend db:seed:demo
 *   DEMO_PHYSICIAN_EMAIL=alice@example.org bun run --cwd apps/backend db:seed:demo
 *
 * Le médecin rattaché aux événements est celui de DEMO_PHYSICIAN_EMAIL, ou à
 * défaut le premier médecin enregistré — jamais un médecin fictif créé par le
 * script, pour que la démonstration se fasse avec le compte réellement utilisé
 * à la connexion.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { CreateBucketCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  instructions,
  media,
  medicalEvent,
  medicalEventSymptom,
  medicalProcedure,
  patient,
  patientCode,
  physician,
  symptom,
} from '../src/infrastructure/schema';
import { SYMPTOMS_SEED } from '../src/infrastructure/seeds/symptomsSeed';
import { createDb, type DbClient } from '../src/shared/db';
import { buildPhotoPublicBaseUrl, createPhotoS3Client } from '../src/shared/storage/s3Client';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const now = new Date();

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * DAY_IN_MS);
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

type PhotoView = 'face' | 'profile' | 'macro';

interface DemoPhoto {
  uuid: string;
  label: string;
  view: PhotoView;
}

interface DemoEvent {
  uuid: string;
  daysAgo: number;
  type: string;
  title: string;
  description: string;
  /** Codes issus de SYMPTOMS_SEED — ceux marqués triggers_alert déclenchent une alerte critique. */
  symptomCodes: string[];
  /** Clichés rattachés à l'événement, déposés dans MinIO. */
  photos: DemoPhoto[];
}

interface DemoPatient {
  /** UUID utilisé uniquement si aucun patient du même nom n'existe déjà. */
  fallbackUuid: string;
  firstName: string;
  lastName: string;
  sex: 'F' | 'M';
  birthdate: string;
  region: string;
  /** null = n'a jamais synchronisé (statut « jamais synchronisé » au tableau de bord). */
  lastSyncedDaysAgo: number | null;
  procedure: {
    uuid: string;
    type: string;
    daysAgo: number;
    hospital: string;
  } | null;
  events: DemoEvent[];
  instruction: {
    uuid: string;
    content: string;
    acknowledgedDaysAgo: number | null;
  } | null;
  code: {
    uuid: string;
    value: string;
    createdDaysAgo: number;
    usedDaysAgo: number | null;
  } | null;
  /** Ce que ce patient démontre à l'écran — repris dans le récapitulatif de fin. */
  demonstrates: string;
}

const DEMO_PATIENTS: readonly DemoPatient[] = [
  {
    fallbackUuid: 'aaaaaaa1-0000-4000-8000-000000000001',
    firstName: 'Bopha',
    lastName: 'Chan',
    sex: 'F',
    birthdate: '2012-03-14',
    region: 'Siem Reap',
    lastSyncedDaysAgo: 1,
    procedure: {
      uuid: 'aaaaaaa1-1000-4000-8000-000000000001',
      type: 'cleft_lip_repair',
      daysAgo: 12,
      hospital: 'Angkor Hospital for Children',
    },
    events: [
      {
        uuid: 'aaaaaaa1-2000-4000-8000-000000000001',
        daysAgo: 11,
        type: 'post_op_follow_up',
        title: 'Contrôle J+1',
        description: 'Cicatrice propre, aucun écoulement. Douleur légère signalée.',
        symptomCodes: ['pain_mild'],
        photos: [
          { uuid: 'aaaaaaa1-5000-4000-8000-000000000001', label: 'Face — J+1', view: 'face' },
        ],
      },
      {
        uuid: 'aaaaaaa1-2000-4000-8000-000000000002',
        daysAgo: 6,
        type: 'post_op_follow_up',
        title: 'Contrôle J+6',
        description: 'Gonflement en diminution, alimentation reprise.',
        symptomCodes: ['swelling'],
        photos: [
          { uuid: 'aaaaaaa1-5000-4000-8000-000000000002', label: 'Face — J+6', view: 'face' },
          {
            uuid: 'aaaaaaa1-5000-4000-8000-000000000003',
            label: 'Profil droit — J+6',
            view: 'profile',
          },
        ],
      },
      {
        uuid: 'aaaaaaa1-2000-4000-8000-000000000003',
        daysAgo: 2,
        type: 'symptom_report',
        title: 'Signalement patient',
        description: 'Fièvre depuis la veille et douleur en nette augmentation.',
        symptomCodes: ['fever', 'pain_severe'],
        photos: [
          { uuid: 'aaaaaaa1-5000-4000-8000-000000000004', label: 'Face — J+10', view: 'face' },
          {
            uuid: 'aaaaaaa1-5000-4000-8000-000000000005',
            label: 'Gros plan cicatrice — J+10',
            view: 'macro',
          },
        ],
      },
    ],
    instruction: {
      uuid: 'aaaaaaa1-3000-4000-8000-000000000001',
      content: 'Nettoyer la cicatrice deux fois par jour et envoyer une photo tous les deux jours.',
      acknowledgedDaysAgo: 9,
    },
    code: {
      uuid: 'aaaaaaa1-4000-4000-8000-000000000001',
      value: '204815',
      createdDaysAgo: 12,
      usedDaysAgo: 11,
    },
    demonstrates: 'alerte critique — a signalé un problème (fièvre, douleur sévère)',
  },
  {
    fallbackUuid: 'aaaaaaa2-0000-4000-8000-000000000002',
    firstName: 'Sokha',
    lastName: 'Meas',
    sex: 'M',
    birthdate: '2009-07-02',
    region: 'Battambang',
    lastSyncedDaysAgo: 11,
    procedure: {
      uuid: 'aaaaaaa2-1000-4000-8000-000000000002',
      type: 'cleft_palate_repair',
      daysAgo: 25,
      hospital: 'Battambang Provincial Hospital',
    },
    events: [
      {
        uuid: 'aaaaaaa2-2000-4000-8000-000000000001',
        daysAgo: 24,
        type: 'post_op_follow_up',
        title: 'Contrôle J+1',
        description: 'Suites opératoires simples, sortie autorisée.',
        symptomCodes: ['pain_mild'],
        photos: [
          { uuid: 'aaaaaaa2-5000-4000-8000-000000000001', label: 'Face — J+1', view: 'face' },
        ],
      },
      {
        uuid: 'aaaaaaa2-2000-4000-8000-000000000002',
        daysAgo: 11,
        type: 'post_op_follow_up',
        title: 'Dernier envoi du patient',
        description: 'Difficulté à manger signalée. Aucune nouvelle depuis.',
        symptomCodes: ['difficulty_eating'],
        photos: [
          { uuid: 'aaaaaaa2-5000-4000-8000-000000000002', label: 'Face — J+14', view: 'face' },
        ],
      },
    ],
    instruction: {
      uuid: 'aaaaaaa2-3000-4000-8000-000000000002',
      content: 'Alimentation liquide pendant trois semaines. Signaler toute fièvre.',
      acknowledgedDaysAgo: null,
    },
    code: {
      uuid: 'aaaaaaa2-4000-4000-8000-000000000002',
      value: '731094',
      createdDaysAgo: 25,
      usedDaysAgo: 24,
    },
    demonstrates: "alerte d'inactivité — aucun signe de vie depuis 11 jours",
  },
  {
    fallbackUuid: 'aaaaaaa3-0000-4000-8000-000000000003',
    firstName: 'Dara',
    lastName: 'Sok',
    sex: 'M',
    birthdate: '2014-11-23',
    region: 'Phnom Penh',
    lastSyncedDaysAgo: 0,
    procedure: {
      uuid: 'aaaaaaa3-1000-4000-8000-000000000003',
      type: 'cleft_lip_repair',
      daysAgo: 5,
      hospital: 'Phnom Penh Referral Hospital',
    },
    events: [
      {
        uuid: 'aaaaaaa3-2000-4000-8000-000000000001',
        daysAgo: 4,
        type: 'post_op_follow_up',
        title: 'Contrôle J+1',
        description: 'Évolution conforme, gonflement modéré attendu.',
        symptomCodes: ['swelling'],
        photos: [
          { uuid: 'aaaaaaa3-5000-4000-8000-000000000001', label: 'Face — J+1', view: 'face' },
        ],
      },
    ],
    instruction: {
      uuid: 'aaaaaaa3-3000-4000-8000-000000000003',
      content: 'Photo de la cicatrice tous les trois jours pendant deux semaines.',
      acknowledgedDaysAgo: 3,
    },
    code: {
      uuid: 'aaaaaaa3-4000-4000-8000-000000000003',
      value: '558602',
      createdDaysAgo: 5,
      usedDaysAgo: 5,
    },
    demonstrates: 'suivi normal — aucune alerte, synchronisation du jour',
  },
  {
    fallbackUuid: 'aaaaaaa4-0000-4000-8000-000000000004',
    firstName: 'Chanthou',
    lastName: 'Neang',
    sex: 'F',
    birthdate: '2016-05-09',
    region: 'Kampong Cham',
    lastSyncedDaysAgo: null,
    procedure: {
      uuid: 'aaaaaaa4-1000-4000-8000-000000000004',
      type: 'cleft_lip_repair',
      daysAgo: 1,
      hospital: 'Kampong Cham Provincial Hospital',
    },
    events: [],
    instruction: null,
    code: {
      uuid: 'aaaaaaa4-4000-4000-8000-000000000004',
      value: '910473',
      createdDaysAgo: 0,
      usedDaysAgo: null,
    },
    demonstrates: 'accès créé, code actif jamais utilisé — statut « jamais synchronisé »',
  },
];

// ─── Clichés de démonstration ────────────────────────────────────────────────

const ASSETS_DIR = join(import.meta.dir, 'demoAssets');
const ASSET_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

interface PhotoAsset {
  body: Buffer;
  contentType: string;
  extension: string;
  fileType: string;
}

interface PhotoStore {
  client: S3Client;
  bucket: string;
  publicBaseUrl: string;
  /** Images réelles déposées dans scripts/demoAssets/, sinon illustrations générées. */
  realAssets: PhotoAsset[];
  uploaded: number;
}

/** Images réelles éventuelles, reprises dans l'ordre alphabétique. */
function loadRealAssets(): PhotoAsset[] {
  if (!existsSync(ASSETS_DIR)) {
    return [];
  }

  return readdirSync(ASSETS_DIR)
    .filter((name) => ASSET_CONTENT_TYPES[extname(name).toLowerCase()] !== undefined)
    .sort()
    .map((name) => {
      const extension = extname(name).toLowerCase();
      const contentType = ASSET_CONTENT_TYPES[extension] as string;

      return {
        body: readFileSync(join(ASSETS_DIR, name)),
        contentType,
        extension,
        fileType: contentType.replace('image/', ''),
      };
    });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface HealingStage {
  swelling: number; // 0 = aucun œdème, 1 = œdème maximal
  redness: number; // 0 = peau calme, 1 = inflammation franche
  sutures: boolean;
  discharge: boolean;
  scarOpacity: number;
}

/**
 * État de la cicatrice au jour post-opératoire donné, corrigé par les symptômes
 * réellement signalés sur l'événement : c'est ce qui rend la chronologie
 * lisible d'une vignette à l'autre, et cohérente avec les pastilles affichées
 * à côté.
 */
function stageFor(postOpDay: number, symptomCodes: string[]): HealingStage {
  const stage: HealingStage =
    postOpDay <= 1
      ? { swelling: 0.95, redness: 0.6, sutures: true, discharge: false, scarOpacity: 0.9 }
      : postOpDay <= 3
        ? { swelling: 0.75, redness: 0.5, sutures: true, discharge: false, scarOpacity: 0.85 }
        : postOpDay <= 8
          ? { swelling: 0.6, redness: 0.45, sutures: true, discharge: false, scarOpacity: 0.8 }
          : postOpDay <= 15
            ? { swelling: 0.35, redness: 0.35, sutures: false, discharge: false, scarOpacity: 0.6 }
            : { swelling: 0.08, redness: 0.15, sutures: false, discharge: false, scarOpacity: 0.3 };

  const codes = symptomCodes.map((code) => code.toLowerCase());

  if (codes.includes('pus') || codes.includes('bad_smell')) {
    stage.discharge = true;
    stage.redness = Math.max(stage.redness, 0.9);
  }

  if (codes.includes('fever') || codes.includes('pain_severe') || codes.includes('bleeding')) {
    stage.redness = Math.max(stage.redness, 0.9);
    stage.swelling = Math.min(1, stage.swelling + 0.25);
  }

  return stage;
}

const VIEW_TRANSFORMS: Record<PhotoView, string> = {
  face: '',
  profile: 'translate(320 240) rotate(-20) scale(0.72 1) translate(-320 -240)',
  macro: 'translate(320 240) scale(1.6) translate(-300 -215)',
};

/**
 * Illustration schématique de la région nez / lèvre supérieure.
 *
 * Aucune photo médicale n'est versionnée dans le dépôt : celles que l'on trouve
 * en ligne sont des visages d'enfants réels, et les placer dans un dossier
 * fabriqué reviendrait à leur attribuer une pathologie inventée. Le dessin
 * montre l'évolution de la cicatrice sans représenter personne, et porte un
 * filigrane pour qu'aucun spectateur ne le prenne pour un cliché réel.
 * Déposer de vraies images dans scripts/demoAssets/ pour les utiliser à la place.
 */
function buildIllustration(photo: DemoPhoto, stage: HealingStage, caption: string): PhotoAsset {
  const transform = VIEW_TRANSFORMS[photo.view];

  const skinLight = `hsl(${26 - stage.redness * 4} ${32 + stage.redness * 10}% ${80 - stage.redness * 5}%)`;
  const skinDark = `hsl(${24 - stage.redness * 4} ${30 + stage.redness * 12}% ${69 - stage.redness * 6}%)`;
  const lipColor = `hsl(${354 - stage.redness * 6} ${38 + stage.redness * 24}% ${62 - stage.redness * 10}%)`;
  const lowerLipColor = `hsl(${354 - stage.redness * 6} ${34 + stage.redness * 22}% ${57 - stage.redness * 9}%)`;
  const scarColor = `hsl(${352 - stage.redness * 8} ${44 + stage.redness * 30}% ${58 - stage.redness * 16}%)`;
  const swellingColor = `hsl(${8 + stage.redness * 2} ${40 + stage.redness * 25}% ${72 - stage.redness * 10}%)`;

  const sutures = stage.sutures
    ? Array.from({ length: 5 }, (_, index) => {
        const y = 172 + index * 15;
        const x = 300 - index * 1.6;
        return `<line x1="${x - 11}" y1="${y}" x2="${x + 11}" y2="${y - 3}" stroke="hsl(215 20% 32%)" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>`;
      }).join('\n    ')
    : '';

  const discharge = stage.discharge
    ? `<ellipse cx="297" cy="186" rx="9" ry="5.5" fill="hsl(48 62% 62%)" opacity="0.85"/>
    <ellipse cx="294" cy="207" rx="7" ry="4.5" fill="hsl(46 58% 58%)" opacity="0.8"/>
    <ellipse cx="292" cy="224" rx="5" ry="3.5" fill="hsl(44 55% 60%)" opacity="0.7"/>`
    : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <defs>
    <linearGradient id="skin" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${skinLight}"/>
      <stop offset="100%" stop-color="${skinDark}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
      <stop offset="55%" stop-color="hsl(20 30% 20%)" stop-opacity="0"/>
      <stop offset="100%" stop-color="hsl(20 30% 20%)" stop-opacity="0.22"/>
    </radialGradient>
  </defs>

  <rect width="640" height="480" fill="url(#skin)"/>

  <g transform="${transform}">
    <ellipse cx="320" cy="300" rx="250" ry="190" fill="${skinDark}" opacity="0.35"/>

    <path d="M258 152 C 278 92 362 92 382 152 Z" fill="${skinLight}" opacity="0.75"/>
    <ellipse cx="286" cy="152" rx="18" ry="10" fill="hsl(18 26% 32%)" opacity="0.5"/>
    <ellipse cx="354" cy="152" rx="18" ry="10" fill="hsl(18 26% 32%)" opacity="0.5"/>
    <rect x="312" y="136" width="16" height="26" rx="8" fill="${skinLight}" opacity="0.9"/>

    <ellipse cx="298" cy="205" rx="${58 + stage.swelling * 42}" ry="${40 + stage.swelling * 30}" fill="${swellingColor}" opacity="${(0.12 + stage.swelling * 0.3).toFixed(2)}"/>

    <path d="M234 240 C 258 212 282 216 300 236 C 306 243 314 243 320 236 C 338 216 362 212 406 240 C 382 265 350 275 320 275 C 290 275 258 265 234 240 Z" fill="${lipColor}"/>
    <path d="M240 282 C 280 267 360 267 400 282 C 386 323 254 323 240 282 Z" fill="${lowerLipColor}"/>
    <path d="M236 278 C 280 268 360 268 404 278" stroke="hsl(350 28% 40%)" stroke-width="3" fill="none" opacity="0.45"/>

    <path d="M300 158 C 296 182 294 208 293 240" stroke="${scarColor}" stroke-width="${(3 + stage.swelling * 3.5).toFixed(1)}" stroke-linecap="round" fill="none" opacity="${stage.scarOpacity}"/>
    ${sutures}
    ${discharge}
  </g>

  <rect width="640" height="480" fill="url(#vignette)"/>

  <rect x="28" y="404" width="${Math.min(584, 40 + caption.length * 11)}" height="48" rx="16" fill="hsl(20 25% 12%)" opacity="0.62"/>
  <text x="48" y="434" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="20" font-weight="600" fill="hsl(30 20% 96%)">${escapeXml(caption)}</text>
  <text x="612" y="44" text-anchor="end" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="12" letter-spacing="2.5" fill="hsl(20 25% 20%)" opacity="0.55">ILLUSTRATION — DÉMONSTRATION</text>
</svg>
`;

  return {
    body: Buffer.from(svg, 'utf8'),
    contentType: 'image/svg+xml',
    extension: '.svg',
    fileType: 'svg',
  };
}

/**
 * Prépare le dépôt des clichés. Renvoie null si MinIO n'est pas joignable : le
 * jeu de données du tableau de bord ne doit pas dépendre du stockage objet.
 */
async function initPhotoStore(): Promise<PhotoStore | null> {
  const client = createPhotoS3Client();
  const bucket = process.env.MINIO_BUCKET_PHOTOS ?? 'photos';

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const name = error instanceof Error ? error.name : '';

    if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') {
      console.warn(`MinIO injoignable (${name || 'erreur inconnue'}) — seed sans photos.`);
      return null;
    }
  }

  return {
    client,
    bucket,
    publicBaseUrl: buildPhotoPublicBaseUrl(),
    realAssets: loadRealAssets(),
    uploaded: 0,
  };
}

// ─── Peuplement ──────────────────────────────────────────────────────────────

async function resolvePhysicianId(db: DbClient): Promise<string> {
  const requestedEmail = process.env.DEMO_PHYSICIAN_EMAIL;

  if (requestedEmail) {
    const rows = await db
      .select({ id: physician.id })
      .from(physician)
      .where(sql`lower(${physician.email}) = lower(${requestedEmail})`)
      .limit(1);

    const found = rows[0];

    if (!found) {
      throw new Error(
        `Aucun medecin avec l'email ${requestedEmail}. Cree le compte depuis le dashboard avant de lancer le seed.`,
      );
    }

    return found.id;
  }

  const rows = await db.select({ id: physician.id }).from(physician).limit(1);
  const found = rows[0];

  if (!found) {
    throw new Error(
      'Aucun medecin en base. Cree ton compte depuis le dashboard, puis relance le seed.',
    );
  }

  return found.id;
}

/**
 * Upsert explicite plutot qu'un ON CONFLICT : l'unicite de `symptom` repose sur
 * un index d'expression `lower(code)` que Postgres ne sait pas inferer depuis
 * `ON CONFLICT (code)` (erreur 42P10). Retourne les identifiants indexes par
 * code en minuscules.
 */
async function upsertSymptoms(db: DbClient): Promise<Map<string, string>> {
  const existingRows = await db
    .select({ uuid: symptom.uuid_symptom, code: symptom.code })
    .from(symptom);

  const idsByCode = new Map(existingRows.map((row) => [row.code.toLowerCase(), row.uuid]));

  for (const entry of SYMPTOMS_SEED) {
    const existingId = idsByCode.get(entry.code.toLowerCase());

    if (existingId) {
      await db
        .update(symptom)
        .set({
          label_fr: entry.label_fr,
          label_km: entry.label_km,
          triggers_alert: entry.triggers_alert,
        })
        .where(eq(symptom.uuid_symptom, existingId));
      continue;
    }

    const inserted = await db
      .insert(symptom)
      .values(entry)
      .returning({ uuid: symptom.uuid_symptom });

    const insertedId = inserted[0];

    if (!insertedId) {
      throw new Error(`Insertion du symptome ${entry.code} sans identifiant retourne.`);
    }

    idsByCode.set(entry.code.toLowerCase(), insertedId.uuid);
  }

  return idsByCode;
}

async function resolvePatientId(db: DbClient, demo: DemoPatient): Promise<string> {
  const lastSyncedAt = demo.lastSyncedDaysAgo === null ? null : daysAgo(demo.lastSyncedDaysAgo);

  // Tri explicite : une base de developpement peut porter plusieurs homonymes
  // laisses par un seed anterieur. Sans `orderBy`, Postgres est libre de rendre
  // une ligne differente a chaque execution, et le seed rattacherait les memes
  // UUID fixes tantot a l'un tantot a l'autre — collision de cle primaire.
  const existing = await db
    .select({ uuid: patient.uuid_patient })
    .from(patient)
    .where(
      and(
        sql`lower(${patient.first_name}) = lower(${demo.firstName})`,
        sql`lower(${patient.last_name}) = lower(${demo.lastName})`,
      ),
    )
    .orderBy(patient.uuid_patient)
    .limit(1);

  const found = existing[0];

  if (found) {
    await db
      .update(patient)
      .set({
        sex: demo.sex,
        birthdate: demo.birthdate,
        region: demo.region,
        last_synced_at: lastSyncedAt,
      })
      .where(eq(patient.uuid_patient, found.uuid));

    return found.uuid;
  }

  await db.insert(patient).values({
    uuid_patient: demo.fallbackUuid,
    first_name: demo.firstName,
    last_name: demo.lastName,
    sex: demo.sex,
    birthdate: demo.birthdate,
    region: demo.region,
    last_synced_at: lastSyncedAt,
  });

  return demo.fallbackUuid;
}

/** Supprime les donnees cliniques du patient dans l'ordre impose par les cles etrangeres. */
async function wipePatientClinicalData(db: DbClient, patientId: string): Promise<void> {
  const procedureRows = await db
    .select({ uuid: medicalProcedure.uuid_medical_procedure })
    .from(medicalProcedure)
    .where(eq(medicalProcedure.uuid_patient, patientId));

  const procedureIds = procedureRows.map((row) => row.uuid);

  if (procedureIds.length > 0) {
    const eventRows = await db
      .select({ uuid: medicalEvent.uuid_event })
      .from(medicalEvent)
      .where(inArray(medicalEvent.uuid_medical_procedure, procedureIds));

    const eventIds = eventRows.map((row) => row.uuid);

    if (eventIds.length > 0) {
      await db.delete(medicalEventSymptom).where(inArray(medicalEventSymptom.uuid_event, eventIds));
      await db.delete(media).where(inArray(media.uuid_event, eventIds));
      await db.delete(medicalEvent).where(inArray(medicalEvent.uuid_event, eventIds));
    }

    await db.delete(instructions).where(inArray(instructions.uuid_medical_procedure, procedureIds));
    await db
      .delete(medicalProcedure)
      .where(inArray(medicalProcedure.uuid_medical_procedure, procedureIds));
  }

  await db.delete(patientCode).where(eq(patientCode.uuid_patient, patientId));
}

/**
 * Depose un cliche dans MinIO et enregistre la ligne `media` correspondante.
 * La cle suit la convention de `S3PhotoStorage` — "{eventId}/{mediaId}" — pour
 * que `GET /photos/:mediaId` la reconstruise depuis `file_url` sans cas
 * particulier.
 */
async function seedPhoto(
  db: DbClient,
  store: PhotoStore,
  event: DemoEvent,
  photo: DemoPhoto,
  takenAt: Date,
  postOpDay: number,
  patientName: string,
): Promise<void> {
  const asset =
    store.realAssets.length > 0
      ? (store.realAssets[store.uploaded % store.realAssets.length] as PhotoAsset)
      : buildIllustration(
          photo,
          stageFor(postOpDay, event.symptomCodes),
          `${photo.label} — ${patientName}`,
        );

  const key = `${event.uuid}/${photo.uuid}${asset.extension}`;

  await store.client.send(
    new PutObjectCommand({
      Bucket: store.bucket,
      Key: key,
      Body: asset.body,
      ContentType: asset.contentType,
    }),
  );

  await db.insert(media).values({
    uuid_media: photo.uuid,
    uuid_event: event.uuid,
    file_url: `${store.publicBaseUrl}/${store.bucket}/${key}`,
    file_type: asset.fileType,
    taken_at: takenAt,
    description: photo.label,
  });

  store.uploaded += 1;
}

async function seedPatient(
  db: DbClient,
  demo: DemoPatient,
  physicianId: string,
  symptomIdsByCode: Map<string, string>,
  photoStore: PhotoStore | null,
): Promise<void> {
  const patientId = await resolvePatientId(db, demo);
  await wipePatientClinicalData(db, patientId);

  if (demo.code) {
    // Le nettoyage ci-dessus ne couvre que le patient resolu. Si un homonyme
    // laisse par un seed anterieur detient encore ce code, la cle primaire
    // entre en collision : on retire la ligne par son UUID, quel qu'en soit
    // le porteur.
    await db.delete(patientCode).where(eq(patientCode.uuid_patient_code, demo.code.uuid));

    await db.insert(patientCode).values({
      uuid_patient_code: demo.code.uuid,
      uuid_patient: patientId,
      code: demo.code.value,
      created_at: daysAgo(demo.code.createdDaysAgo),
      used_at: demo.code.usedDaysAgo === null ? null : daysAgo(demo.code.usedDaysAgo),
      is_active: true,
    });
  }

  if (!demo.procedure) {
    return;
  }

  await db.insert(medicalProcedure).values({
    uuid_medical_procedure: demo.procedure.uuid,
    uuid_patient: patientId,
    procedure_type: demo.procedure.type,
    date: dateOnly(daysAgo(demo.procedure.daysAgo)),
    hospital_name: demo.procedure.hospital,
  });

  const patientName = `${demo.firstName} ${demo.lastName}`;

  for (const event of demo.events) {
    const occurredAt = daysAgo(event.daysAgo);

    await db.insert(medicalEvent).values({
      uuid_event: event.uuid,
      uuid_medical_procedure: demo.procedure.uuid,
      uuid_physician: physicianId,
      event_type: event.type,
      event_title: event.title,
      description: event.description,
      created_at: occurredAt,
    });

    for (const code of event.symptomCodes) {
      const symptomId = symptomIdsByCode.get(code.toLowerCase());

      if (!symptomId) {
        throw new Error(`Symptome absent de SYMPTOMS_SEED : ${code}`);
      }

      await db
        .insert(medicalEventSymptom)
        .values({ uuid_event: event.uuid, uuid_symptom: symptomId })
        .onConflictDoNothing();
    }

    if (!photoStore) {
      continue;
    }

    const postOpDay = demo.procedure.daysAgo - event.daysAgo;

    for (const photo of event.photos) {
      await seedPhoto(db, photoStore, event, photo, occurredAt, postOpDay, patientName);
    }
  }

  if (demo.instruction) {
    await db.insert(instructions).values({
      uuid_instructions: demo.instruction.uuid,
      uuid_physician: physicianId,
      uuid_medical_procedure: demo.procedure.uuid,
      content: demo.instruction.content,
      acknowledged_at:
        demo.instruction.acknowledgedDaysAgo === null
          ? null
          : daysAgo(demo.instruction.acknowledgedDaysAgo),
    });
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seedDemo est un script de developpement — refus de s executer en production.');
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const db = createDb(process.env.DATABASE_URL);

  const physicianId = await resolvePhysicianId(db);
  const symptomIdsByCode = await upsertSymptoms(db);
  const photoStore = await initPhotoStore();

  for (const demo of DEMO_PATIENTS) {
    await seedPatient(db, demo, physicianId, symptomIdsByCode, photoStore);
    console.log(`  ${demo.firstName} ${demo.lastName} — ${demo.demonstrates}`);
  }

  const photoSource =
    photoStore === null
      ? 'aucune (MinIO injoignable)'
      : photoStore.realAssets.length > 0
        ? `${photoStore.uploaded} depuis scripts/demoAssets/`
        : `${photoStore.uploaded} illustrations generees`;

  console.log('');
  console.log(
    `DEMO-01 seed : ${DEMO_PATIENTS.length} patients rattaches au medecin ${physicianId}`,
  );
  console.log(`Photos : ${photoSource}`);
  console.log('Attendu au tableau de bord : 4 patients, 3 alertes (2 critiques, 1 inactivite).');
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
