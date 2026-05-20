import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../infrastructure/schema';

// ============================================================================
// PARTIE DEV : Usine d'instanciation dynamique
// ============================================================================
export function createDb(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
  });

  return drizzle({
    client: pool,
    schema,
  });
}

export type DbClient = ReturnType<typeof createDb>;

// ============================================================================
// PARTIE FEATURE : Instance globale par défaut
// ============================================================================
// On instancie un pool par défaut (nécessaire pour DrizzlePatientCodeRepository).
// Si DATABASE_URL n'est pas défini, on ne throw pas d'erreur ici pour
// permettre au fallback InMemory de l'application de s'exécuter.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
