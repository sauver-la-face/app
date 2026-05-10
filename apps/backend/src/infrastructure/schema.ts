import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// physician sert de table user pour Better Auth (field mapping via drizzleAdapter)
// Les propriétés Drizzle correspondent aux noms attendus par Better Auth.
// Les noms de colonnes SQL restent inchangés pour préserver les migrations existantes.
export const physician = pgTable(
  'physician',
  {
    // Better Auth fields — noms de propriétés alignés sur ce qu'attend le drizzleAdapter
    id: uuid('uuid_physician').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }),
    email: varchar('mail', { length: 255 }).notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
    twoFactorEnabled: boolean('two_factor_enabled').default(false),
    // Domain fields — spécifiques au médecin
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    phoneNumber: varchar('phone_number', { length: 20 }),
    // Conservé pour compatibilité migration — non utilisé par Better Auth (auth déléguée via account)
    passwordHash: text('password_hash'),
  },
  (t) => [uniqueIndex('physician_mail_unique').on(sql`lower(${t.email})`)],
);

export const patient = pgTable('patient', {
  uuid_patient: uuid('uuid_patient').primaryKey().defaultRandom(),
  first_name: varchar('first_name', { length: 100 }), // null si patient anonymise (RGPD art. 17.3.c)
  last_name: varchar('last_name', { length: 100 }), // null si patient anonymise (RGPD art. 17.3.c)
  sex: varchar('sex', { length: 10 }),
  birthdate: date('birthdate'),
  region: varchar('region', { length: 100 }),
  anonymized_at: timestamp('anonymized_at', { withTimezone: true }), // renseigne lors d'une demande d'effacement RGPD
  last_synced_at: timestamp('last_synced_at', { withTimezone: true }), // mis a jour a chaque sync mobile reussie
});

// Soft delete automatique apres 48h si le code n'a pas ete utilise (job cron)
// Une fois utilise (used_at NOT NULL), le code est valide pour toujours
export const patientCode = pgTable(
  'patient_code',
  {
    uuid_patient_code: uuid('uuid_patient_code').primaryKey().defaultRandom(),
    uuid_patient: uuid('uuid_patient')
      .notNull()
      .references(() => patient.uuid_patient),
    code: varchar('code', { length: 6 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    used_at: timestamp('used_at', { withTimezone: true }),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    is_active: boolean('is_active').notNull().default(true),
    revoked_at: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('patient_code_code_active_unique')
      .on(t.code)
      .where(sql`deleted_at IS NULL AND revoked_at IS NULL`),
    uniqueIndex('patient_code_patient_active_unique')
      .on(t.uuid_patient)
      .where(
        sql`is_active = true AND used_at IS NULL AND deleted_at IS NULL AND revoked_at IS NULL`,
      ),
    // Accelere la recherche de tous les codes d'un patient (actifs + historique)
    // Optimise le cron de soft delete apres 48h (WHERE created_at < now() - 48h AND used_at IS NULL AND deleted_at IS NULL)
    // Index partiel : couvre uniquement les codes non consommes et non supprimes - seuls candidats du cron
    index('patient_code_created_at_idx')
      .on(t.created_at)
      .where(sql`used_at IS NULL AND deleted_at IS NULL`),
  ],
);

// FK intentionnellement sans ON DELETE CASCADE sur toutes les tables liees a patient.
// Raison : la suppression d'un patient n'est jamais un DELETE SQL - c'est une anonymisation
// applicative (first_name/last_name/birthdate -> NULL, anonymized_at renseigne).
// Les donnees medicales sont conservees 20 ans (obligation HDS / Code de la sante publique,
// art. L1110-4). Un CASCADE les detruirait et constituerait une violation legale.
export const medicalProcedure = pgTable(
  'medical_procedure',
  {
    uuid_medical_procedure: uuid('uuid_medical_procedure').primaryKey().defaultRandom(),
    uuid_patient: uuid('uuid_patient')
      .notNull()
      .references(() => patient.uuid_patient),
    procedure_type: varchar('procedure_type', { length: 100 }).notNull(),
    date: date('date').notNull(),
    hospital_name: varchar('hospital_name', { length: 200 }),
  },
  (t) => [index('medical_procedure_uuid_patient_idx').on(t.uuid_patient)],
);

export const medicalEvent = pgTable(
  'medical_event',
  {
    uuid_event: uuid('uuid_event').primaryKey().defaultRandom(),
    uuid_medical_procedure: uuid('uuid_medical_procedure')
      .notNull()
      .references(() => medicalProcedure.uuid_medical_procedure),
    uuid_physician: uuid('uuid_physician').references(() => physician.id),
    event_type: varchar('event_type', { length: 100 }).notNull(),
    event_title: varchar('event_title', { length: 200 }),
    description: text('description'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('medical_event_uuid_medical_procedure_idx').on(t.uuid_medical_procedure),
    index('medical_event_uuid_physician_idx').on(t.uuid_physician),
  ],
);

export const symptom = pgTable(
  'symptom',
  {
    uuid_symptom: uuid('uuid_symptom').primaryKey().defaultRandom(),
    code: varchar('code', { length: 50 }).notNull(),
    label_fr: varchar('label_fr', { length: 100 }).notNull(),
    label_km: varchar('label_km', { length: 100 }).notNull(),
    triggers_alert: boolean('triggers_alert').notNull().default(false),
  },
  (t) => [uniqueIndex('symptom_code_unique').on(sql`lower(${t.code})`)],
);

export const medicalEventSymptom = pgTable(
  'medical_event_symptom',
  {
    uuid_event: uuid('uuid_event')
      .notNull()
      .references(() => medicalEvent.uuid_event),
    uuid_symptom: uuid('uuid_symptom')
      .notNull()
      .references(() => symptom.uuid_symptom),
  },
  (t) => [
    primaryKey({ columns: [t.uuid_event, t.uuid_symptom] }),
    index('medical_event_symptom_uuid_symptom_idx').on(t.uuid_symptom),
  ],
);

export const media = pgTable(
  'media',
  {
    uuid_media: uuid('uuid_media').primaryKey().defaultRandom(),
    uuid_event: uuid('uuid_event')
      .notNull()
      .references(() => medicalEvent.uuid_event),
    file_url: text('file_url').notNull(),
    file_type: varchar('file_type', { length: 20 }).notNull(),
    taken_at: timestamp('taken_at', { withTimezone: true }).notNull(),
    description: text('description'),
  },
  (t) => [index('media_uuid_event_idx').on(t.uuid_event)],
);

export const instructions = pgTable(
  'instructions',
  {
    uuid_instructions: uuid('uuid_instructions').primaryKey().defaultRandom(),
    uuid_physician: uuid('uuid_physician')
      .notNull()
      .references(() => physician.id),
    uuid_medical_procedure: uuid('uuid_medical_procedure')
      .notNull()
      .references(() => medicalProcedure.uuid_medical_procedure),
    content: text('content').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acknowledged_at: timestamp('acknowledged_at', { withTimezone: true }),
  },
  (t) => [
    index('instructions_uuid_physician_idx').on(t.uuid_physician),
    index('instructions_uuid_medical_procedure_idx').on(t.uuid_medical_procedure),
    index('instructions_unread_idx')
      .on(t.uuid_medical_procedure)
      .where(sql`acknowledged_at IS NULL`),
  ],
);

// ─── Tables Better Auth ───────────────────────────────────────────────────────
// Ces tables sont gérées exclusivement par Better Auth.
// Les noms de propriétés Drizzle correspondent exactement aux noms de champs
// attendus par le drizzleAdapter de Better Auth.

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
    withTimezone: true,
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const twoFactor = pgTable('two_factor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: text('user_id').notNull(),
  verified: boolean('verified').default(false),
});
