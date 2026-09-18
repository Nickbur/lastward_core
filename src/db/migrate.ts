import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

/**
 * Applies all pending Drizzle migrations from ./drizzle/migrations, then exits.
 * Generate migrations first with `npm run db:generate`. The Docker CMD runs this
 * before starting the server, so a fresh `docker compose up` is schema-ready.
 */
async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[migrate] applying migrations…');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  // eslint-disable-next-line no-console
  console.log('[migrate] done.');
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] failed:', err);
  process.exit(1);
});
