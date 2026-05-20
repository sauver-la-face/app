import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle({ client: pool });

await migrate(db, {
  migrationsFolder: './drizzle',
});

console.log('Migrations applied successfully');
await pool.end();
