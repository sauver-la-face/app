import { symptom } from '../src/infrastructure/schema';
import { SYMPTOMS_SEED } from '../src/infrastructure/seeds/symptomsSeed';
import { createDb } from '../src/shared/db';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const db = createDb(process.env.DATABASE_URL);

  for (const entry of SYMPTOMS_SEED) {
    await db
      .insert(symptom)
      .values(entry)
      .onConflictDoUpdate({
        target: symptom.code,
        set: {
          label_fr: entry.label_fr,
          label_km: entry.label_km,
          triggers_alert: entry.triggers_alert,
        },
      });
  }

  console.log(`MED-01 seed: upserted ${SYMPTOMS_SEED.length} symptoms`);
}

void main();
