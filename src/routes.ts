import type { FastifyInstance } from 'fastify';
import { requireOwner } from './auth.js';
import {
    checkinHandler,
    deleteSwitchHandler,
    disarmHandler,
    getSwitchHandler,
    listSwitchesHandler,
    publicPageHandler,
    putPayloadHandler,
    putSwitchHandler,
    releaseHandler,
    releasePageHandler,
} from './handlers.js';

/**
 * Owner API, mounted under `/v1`. Bearer-gated (single-tenant): the `requireOwner`
 * hook is added inside this encapsulated plugin so it applies ONLY to these routes
 * — the public plugins below register separately and stay unauthenticated.
 */
export async function ownerRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.addHook('preHandler', requireOwner);

    fastify.get('/switches', listSwitchesHandler);
    fastify.get('/switches/:id', getSwitchHandler);
    fastify.put('/switches/:id', putSwitchHandler);
    fastify.delete('/switches/:id', deleteSwitchHandler);
    fastify.post('/switches/:id/checkin', checkinHandler);
    fastify.post('/switches/:id/disarm', disarmHandler);
    fastify.put('/switches/:id/actions/:actionId/payload', putPayloadHandler);
}

/**
 * Public recipient JSON surface, also under `/v1` but a SEPARATE plugin so the
 * owner auth hook does not apply. A fired switch delivers a tokenized link; the
 * recipient needs no account. Content-blind: the server serves ciphertext and the
 * recipient decrypts in the browser.
 */
export async function publicApiRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.get('/release/:token', releaseHandler);
}

/**
 * Public HTML surfaces at the server root (no `/v1` prefix): the recipient release
 * page and the self-host-only public "leak" page.
 */
export async function publicPageRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.get('/release/:token', releasePageHandler);
    fastify.get('/p/:slug', publicPageHandler);
}
