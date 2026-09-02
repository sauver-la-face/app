import { sql } from 'drizzle-orm';
import { symptom } from '../src/infrastructure/schema';
import { SYMPTOMS_SEED } from '../src/infrastructure/seeds/symptomsSeed';
import { createDb } from '../src/shared/db';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const db = createDb(process.env.DATABASE_URL);

  let inseres = 0;
  let misAJour = 0;

  // L'unicite de symptom.code est portee par un index fonctionnel sur
  // lower(code) (ADR 0016). PostgreSQL exige que la cible d'un ON CONFLICT
  // corresponde exactement a l'index, et l'API Drizzle n'accepte qu'une colonne
  // nue, pas une expression. Le seed visait donc `code`, ce qui echouait avec
  // « no unique or exclusion constraint matching the ON CONFLICT
  // specification » et le rendait inexecutable sur une base neuve.
  //
  // Sur huit lignes, une lecture puis insertion ou mise a jour est plus lisible
  // qu'un upsert en SQL brut, et reste dans l'API typee. La comparaison passe
  // par lower() des deux cotes pour suivre la meme semantique que l'index.
  for (const entry of SYMPTOMS_SEED) {
    const [existant] = await db
      .select({ uuid: symptom.uuid_symptom })
      .from(symptom)
      .where(sql`lower(${symptom.code}) = lower(${entry.code})`)
      .limit(1);

    if (existant) {
      await db
        .update(symptom)
        .set({
          label_fr: entry.label_fr,
          label_km: entry.label_km,
          triggers_alert: entry.triggers_alert,
        })
        .where(sql`${symptom.uuid_symptom} = ${existant.uuid}`);
      misAJour += 1;
      continue;
    }

    await db.insert(symptom).values(entry);
    inseres += 1;
  }

  console.log(`MED-01 seed: ${inseres} symptome(s) insere(s), ${misAJour} mis a jour`);
}

void main();
