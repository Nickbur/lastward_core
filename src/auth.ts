import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { env } from './env.js';
import { AuthError } from './shared/errors.js';

/** Constant-time string compare (guards the owner token against timing attacks). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Owner-API gate. The self-host core is single-tenant: one bearer token
 * (`OWNER_TOKEN`) authorizes every `/v1/switches*` call. Registered as a
 * `preHandler` on the owner routes only — the public release + public-page routes
 * stay unauthenticated.
 */
export async function requireOwner(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AuthError('unauthenticated', 'missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token || !safeEqual(token, env.OWNER_TOKEN)) {
    throw new AuthError('unauthenticated', 'invalid owner token');
  }
}
