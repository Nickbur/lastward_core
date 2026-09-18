import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env.js';
import * as schema from './schema.js';

const { Pool } = pg;

/** Shared PostgreSQL connection pool. */
export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
});

/** Drizzle ORM instance bound to the full schema (enables the relational query API). */
export const db = drizzle(pool, { schema });

export type DB = typeof db;
export { schema };
