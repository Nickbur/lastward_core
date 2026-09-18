import { buildApp } from './app.js';
import { env } from './env.js';
import { pool } from './db/client.js';
import { runSweep } from './sweep.js';

/**
 * Optional in-process sweep. Production can instead drive it from cron
 * (`node dist/sweep.js`); this interval is a convenience so switches warn + fire
 * end-to-end without an external scheduler. SWEEP_INTERVAL_SECONDS=0 disables it.
 */
function startSweep(app: Awaited<ReturnType<typeof buildApp>>): NodeJS.Timeout | null {
    const seconds = env.SWEEP_INTERVAL_SECONDS;
    if (seconds <= 0) {
        app.log.info('sweep: in-process interval disabled (SWEEP_INTERVAL_SECONDS=0) — use cron');
        return null;
    }
    app.log.info(`sweep: in-process every ${seconds}s`);
    const timer = setInterval(() => {
        void runSweep()
            .then((r) => {
                if (r.warned || r.fired || r.failed) app.log.info({ sweep: r }, 'sweep');
            })
            .catch((err) => app.log.error(err, 'sweep failed'));
    }, seconds * 1000);
    timer.unref?.(); // never keep the process alive just for the sweep
    return timer;
}

async function main(): Promise<void> {
    const app = await buildApp();
    const sweepTimer = startSweep(app);

    const shutdown = async (signal: string): Promise<void> => {
        app.log.info(`${signal} received, shutting down…`);
        try {
            if (sweepTimer) clearInterval(sweepTimer);
            await app.close();
            await pool.end();
        } finally {
            process.exit(0);
        }
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    try {
        await app.listen({ port: env.PORT, host: env.HOST });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

void main();
