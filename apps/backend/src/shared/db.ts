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
