import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../infrastructure/schema';

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

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
