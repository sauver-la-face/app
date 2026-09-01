/**
 * DEMO-01 — Jeu de données de démonstration du poste de travail chirurgien.
 *
 * Peuple la base avec quatre patients couvrant les quatre états du parcours de
 * suivi, de façon à ce que le tableau de bord (WEB-01) affiche réellement ce
 * qui est annoncé pendant la soutenance : des patients opérés, une alerte
 * critique (symptôme déclencheur) et une alerte d'inactivité (7 jours sans
 * synchronisation).
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

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const now = new Date();

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * DAY_IN_MS);
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

interface DemoEvent {
  uuid: string;
  daysAgo: number;
  type: string;
  title: string;
  description: string;
  /** Codes issus de SYMPTOMS_SEED — ceux marqués triggers_alert déclenchent une alerte critique. */
  symptomCodes: string[];
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
      },
      {
        uuid: 'aaaaaaa1-2000-4000-8000-000000000002',
        daysAgo: 6,
        type: 'post_op_follow_up',
        title: 'Contrôle J+6',
        description: 'Gonflement en diminution, alimentation reprise.',
        symptomCodes: ['swelling'],
      },
      {
        uuid: 'aaaaaaa1-2000-4000-8000-000000000003',
        daysAgo: 2,
        type: 'symptom_report',
        title: 'Signalement patient',
        description: 'Fièvre depuis la veille et douleur en nette augmentation.',
        symptomCodes: ['fever', 'pain_severe'],
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
      },
      {
        uuid: 'aaaaaaa2-2000-4000-8000-000000000002',
        daysAgo: 11,
        type: 'post_op_follow_up',
        title: 'Dernier envoi du patient',
        description: 'Difficulté à manger signalée. Aucune nouvelle depuis.',
        symptomCodes: ['difficulty_eating'],
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

  const existing = await db
    .select({ uuid: patient.uuid_patient })
    .from(patient)
    .where(
      and(
        sql`lower(${patient.first_name}) = lower(${demo.firstName})`,
        sql`lower(${patient.last_name}) = lower(${demo.lastName})`,
      ),
    )
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

async function seedPatient(
  db: DbClient,
  demo: DemoPatient,
  physicianId: string,
  symptomIdsByCode: Map<string, string>,
): Promise<void> {
  const patientId = await resolvePatientId(db, demo);
  await wipePatientClinicalData(db, patientId);

  if (demo.code) {
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

  for (const event of demo.events) {
    await db.insert(medicalEvent).values({
      uuid_event: event.uuid,
      uuid_medical_procedure: demo.procedure.uuid,
      uuid_physician: physicianId,
      event_type: event.type,
      event_title: event.title,
      description: event.description,
      created_at: daysAgo(event.daysAgo),
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

  for (const demo of DEMO_PATIENTS) {
    await seedPatient(db, demo, physicianId, symptomIdsByCode);
    console.log(`  ${demo.firstName} ${demo.lastName} — ${demo.demonstrates}`);
  }

  console.log('');
  console.log(
    `DEMO-01 seed : ${DEMO_PATIENTS.length} patients rattaches au medecin ${physicianId}`,
  );
  console.log('Attendu au tableau de bord : 4 patients, 3 alertes (2 critiques, 1 inactivite).');
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
