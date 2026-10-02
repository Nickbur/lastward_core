// Runs after `npm run db:generate` (the `postdb:generate` script): drizzle-kit writes migration
// SQL with tab indentation, which this turns into the repo's 4 spaces (leading whitespace only —
// SQL whitespace is insignificant and the migrator matches migrations by timestamp, not content).
// The JSON snapshots are formatted by Prettier in the same script.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'drizzle/migrations';
for (const name of readdirSync(dir)) {
    if (!name.endsWith('.sql')) continue;
    const file = join(dir, name);
    const text = readFileSync(file, 'utf8');
    const next = text.replace(/^[ \t]+/gm, (ws) => ws.replace(/\t/g, '    '));
    if (next !== text) writeFileSync(file, next);
}
