import { eq } from 'drizzle-orm';
import {
  instructions,
  media,
  medicalEvent,
  medicalEventSymptom,
  medicalProcedure,
  patient,
  physician,
  symptom,
} from '../src/infrastructure/schema';
import { createDb } from '../src/shared/db';

const ids = {
  patientId: '11111111-1111-4111-8111-111111111111',
  physicianId: '66666666-6666-4666-8666-666666666666',
  procedureId: '77777777-7777-4777-8777-777777777777',
  eventId: '33333333-3333-4333-8333-333333333333',
  symptomId: '44444444-4444-4444-8444-444444444444',
  instructionId: '55555555-5555-4555-8555-555555555555',
  mediaId: '22222222-2222-4222-8222-222222222222',
} as const;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const db = createDb(process.env.DATABASE_URL);

  await db.delete(medicalEventSymptom).where(eq(medicalEventSymptom.uuid_event, ids.eventId));
  await db.delete(media).where(eq(media.uuid_media, ids.mediaId));
  await db.delete(instructions).where(eq(instructions.uuid_instructions, ids.instructionId));
  await db.delete(medicalEvent).where(eq(medicalEvent.uuid_event, ids.eventId));
  await db.delete(symptom).where(eq(symptom.uuid_symptom, ids.symptomId));
  await db
    .delete(medicalProcedure)
    .where(eq(medicalProcedure.uuid_medical_procedure, ids.procedureId));
  await db.delete(patient).where(eq(patient.uuid_patient, ids.patientId));
  await db.delete(physician).where(eq(physician.uuid_physician, ids.physicianId));

  await db.insert(physician).values({
    uuid_physician: ids.physicianId,
    first_name: 'Jean',
    last_name: 'Dupont',
    phone_number: '+33123456789',
    mail: 'jean.dupont@example.com',
    password_hash: 'not-used-for-sync',
  });

  await db.insert(patient).values({
    uuid_patient: ids.patientId,
    first_name: 'Sok',
    last_name: 'Chea',
    sex: 'M',
    birthdate: '2010-01-01',
    region: 'Phnom Penh',
  });

  await db.insert(medicalProcedure).values({
    uuid_medical_procedure: ids.procedureId,
    uuid_patient: ids.patientId,
    procedure_type: 'cleft_lip_repair',
    date: '2026-04-20',
    hospital_name: 'Phnom Penh Hospital',
  });

  await db.insert(medicalEvent).values({
    uuid_event: ids.eventId,
    uuid_medical_procedure: ids.procedureId,
    uuid_physician: ids.physicianId,
    event_type: 'post_op_follow_up',
    event_title: 'Contrôle J+8',
    description: 'Événement seed pour SYNC-01',
  });

  await db.insert(symptom).values({
    uuid_symptom: ids.symptomId,
    code: 'swelling_moderate',
    label_fr: 'Gonflement modéré',
    label_km: 'ហើមមធ្យម',
    triggers_alert: false,
  });

  await db.insert(instructions).values({
    uuid_instructions: ids.instructionId,
    uuid_physician: ids.physicianId,
    uuid_medical_procedure: ids.procedureId,
    content: 'Nettoyer la cicatrice deux fois par jour',
    acknowledged_at: null,
  });

  await db.insert(media).values({
    uuid_media: ids.mediaId,
    uuid_event: ids.eventId,
    file_url: 'https://server.example/existing-media.jpg',
    file_type: 'jpeg',
    taken_at: new Date('2026-04-28T09:00:00.000Z'),
    description: 'server-seed-media',
  });

  console.log('SYNC-01 seed created');
  console.log(JSON.stringify(ids, null, 2));
}

void main();
