import {
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
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
export const patientCode = pgTable('patient_code', {
  uuid_patient_code: uuid('uuid_patient_code').primaryKey().defaultRandom(),
  uuid_patient: uuid('uuid_patient')
    .notNull()
    .references(() => patient.uuid_patient),
  code: varchar('code', { length: 6 }).notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  used_at: timestamp('used_at'), // null = jamais utilisé
  deleted_at: timestamp('deleted_at'), // soft delete si used_at IS NULL après 48h
  is_active: integer('is_active').notNull().default(1), // boolean: 1 = actif, 0 = inactif
});

export const medicalProcedure = pgTable('medical_procedure', {
  uuid_medical_procedure: uuid('uuid_medical_procedure').primaryKey().defaultRandom(),
  uuid_patient: uuid('uuid_patient')
    .notNull()
    .references(() => patient.uuid_patient),
  procedure_type: varchar('procedure_type', { length: 100 }).notNull(),
  date: date('date').notNull(),
  hospital_name: varchar('hospital_name', { length: 200 }),
});

export const medicalEvent = pgTable('medical_event', {
  uuid_event: uuid('uuid_event').primaryKey().defaultRandom(),
  uuid_medical_procedure: uuid('uuid_medical_procedure')
    .notNull()
    .references(() => medicalProcedure.uuid_medical_procedure),
  uuid_physician: uuid('uuid_physician').references(() => physician.uuid_physician),
  event_type: varchar('event_type', { length: 100 }).notNull(),
  event_title: varchar('event_title', { length: 200 }),
  description: text('description'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  // severity remplacé par pictogrammes de symptômes (voir table symptom + medical_event_symptom)
});

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
export const medicalEventSymptom = pgTable('medical_event_symptom', {
  uuid_medical_event_symptom: uuid('uuid_medical_event_symptom').primaryKey().defaultRandom(),
  uuid_event: uuid('uuid_event')
    .notNull()
    .references(() => medicalEvent.uuid_event),
  uuid_symptom: uuid('uuid_symptom')
    .notNull()
    .references(() => symptom.uuid_symptom),
});

export const media = pgTable('media', {
  uuid_media: uuid('uuid_media').primaryKey().defaultRandom(),
  uuid_event: uuid('uuid_event')
    .notNull()
    .references(() => medicalEvent.uuid_event),
  file_url: text('file_url').notNull(),
  file_type: varchar('file_type', { length: 20 }).notNull(), // jpeg, png
  taken_at: timestamp('taken_at').notNull(),
  description: text('description'),
});

export const instructions = pgTable('instructions', {
  uuid_instructions: uuid('uuid_instructions').primaryKey().defaultRandom(),
  uuid_physician: uuid('uuid_physician')
    .notNull()
    .references(() => physician.uuid_physician),
  uuid_medical_procedure: uuid('uuid_medical_procedure')
    .notNull()
    .references(() => medicalProcedure.uuid_medical_procedure),
  content: text('content').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  acknowledged_at: timestamp('acknowledged_at'), // null = non lu, renseigné à la lecture par le patient
});
