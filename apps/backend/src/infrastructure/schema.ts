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

export const physician = pgTable('physician', {
  uuid_physician: uuid('uuid_physician').primaryKey().defaultRandom(),
  first_name: varchar('first_name', { length: 100 }).notNull(),
  last_name: varchar('last_name', { length: 100 }).notNull(),
  phone_number: varchar('phone_number', { length: 20 }),
  mail: varchar('mail', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
});

export const patient = pgTable('patient', {
  uuid_patient: uuid('uuid_patient').primaryKey().defaultRandom(),
  first_name: varchar('first_name', { length: 100 }).notNull(),
  last_name: varchar('last_name', { length: 100 }).notNull(),
  sex: varchar('sex', { length: 10 }),
  birthdate: date('birthdate'),
  region: varchar('region', { length: 100 }),
});

// Soft delete automatique après 48h si le code n'a pas été utilisé (job cron)
// Une fois utilisé (used_at NOT NULL), le code est valide pour toujours
export const patientCode = pgTable(
  'patient_code',
  {
    uuid_patient_code: uuid('uuid_patient_code').primaryKey().defaultRandom(),
    uuid_patient: uuid('uuid_patient')
      .notNull()
      .references(() => patient.uuid_patient),
    // varchar(6) garantit la longueur max uniquement — pas le format numérique.
    // La validation "6 chiffres stricts" est intentionnellement dans le Value Object
    // PatientCodeValue (packages/shared/src/domain/) et non en contrainte CHECK SQL.
    // Raison : les règles métier vivent dans le domaine (DDD), pas dans la base de données.
    // PatientCodeValue doit être créé et utilisé dans auth/domain/ avant toute insertion.
    code: varchar('code', { length: 6 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    used_at: timestamp('used_at', { withTimezone: true }), // null = jamais utilisé
    deleted_at: timestamp('deleted_at', { withTimezone: true }), // soft delete si used_at IS NULL après 48h
    is_active: boolean('is_active').notNull().default(true), // false = désactivé (révoqué ou supprimé)
    revoked_at: timestamp('revoked_at', { withTimezone: true }), // null = non révoqué, renseigné par le médecin pour couper l'accès
  },
  (t) => [
    // Unicité globale du code (actif ou consommé) — empêche la réattribution d'un code déjà utilisé.
    // is_active et used_at intentionnellement absents : un code peut sortir de ces états sans que
    // deleted_at ou revoked_at soit renseigné, ce qui le rendrait réattribuable à tort.
    // Seuls deleted_at et revoked_at garantissent qu'un code ne sera jamais réutilisé.
    uniqueIndex('patient_code_code_active_unique')
      .on(t.code)
      .where(sql`deleted_at IS NULL AND revoked_at IS NULL`),
    // Un seul code actif possible par patient
    uniqueIndex('patient_code_patient_active_unique')
      .on(t.uuid_patient)
      .where(
        sql`is_active = true AND used_at IS NULL AND deleted_at IS NULL AND revoked_at IS NULL`,
      ),
    // Accélère la recherche de tous les codes d'un patient (actifs + historique)
    index('patient_code_uuid_patient_idx').on(t.uuid_patient),
  ],
);

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
    uuid_physician: uuid('uuid_physician').references(() => physician.uuid_physician),
    event_type: varchar('event_type', { length: 100 }).notNull(),
    event_title: varchar('event_title', { length: 200 }),
    description: text('description'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // severity remplacé par pictogrammes de symptômes (voir table symptom + medical_event_symptom)
  },
  (t) => [index('medical_event_uuid_medical_procedure_idx').on(t.uuid_medical_procedure)],
);

// Liste des pictogrammes de symptômes disponibles
// La liste définitive est à valider avec les chirurgiens toulousains (MED-01)
export const symptom = pgTable('symptom', {
  uuid_symptom: uuid('uuid_symptom').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(), // ex: 'pain_severe', 'bleeding'
  label_fr: varchar('label_fr', { length: 100 }).notNull(),
  label_km: varchar('label_km', { length: 100 }).notNull(), // khmer
  triggers_alert: boolean('triggers_alert').notNull().default(false), // true = alerte automatique si sélectionné
});

// Relation N-N entre un événement médical et les symptômes sélectionnés par le patient
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
  (t) => [primaryKey({ columns: [t.uuid_event, t.uuid_symptom] })],
);

export const media = pgTable(
  'media',
  {
    uuid_media: uuid('uuid_media').primaryKey().defaultRandom(),
    uuid_event: uuid('uuid_event')
      .notNull()
      .references(() => medicalEvent.uuid_event),
    file_url: text('file_url').notNull(),
    file_type: varchar('file_type', { length: 20 }).notNull(), // jpeg, png
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
      .references(() => physician.uuid_physician),
    uuid_medical_procedure: uuid('uuid_medical_procedure')
      .notNull()
      .references(() => medicalProcedure.uuid_medical_procedure),
    content: text('content').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acknowledged_at: timestamp('acknowledged_at', { withTimezone: true }), // null = non lu, renseigné à la lecture par le patient
  },
  (t) => [
    index('instructions_uuid_physician_idx').on(t.uuid_physician),
    index('instructions_uuid_medical_procedure_idx').on(t.uuid_medical_procedure),
  ],
);
