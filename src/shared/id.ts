import { randomBytes } from 'node:crypto';

/**
 * UUIDv7 generator (time-ordered UUID).
 *
 * PostgreSQL 17 has no built-in `uuidv7()` — that arrives in PG 18 — so IDs are
 * minted in the application. v7 is chosen over v4 because the first 48 bits are
 * a Unix-millisecond timestamp: rows insert at the tail of the primary-key index
 * instead of scattering across it, which keeps writes cheap as the tables grow.
 * The value is still a random-looking UUID, so it is safe to expose in URLs.
 *
 * Layout (RFC 9562):
 *   unix_ts_ms (48 bits) | ver (4) | rand_a (12) | var (2) | rand_b (62)
 */
export function uuidv7(): string {
    const now = Date.now();
    const bytes = randomBytes(16);

    // 48-bit big-endian millisecond timestamp.
    bytes[0] = (now / 0x10000000000) & 0xff;
    bytes[1] = (now / 0x100000000) & 0xff;
    bytes[2] = (now / 0x1000000) & 0xff;
    bytes[3] = (now / 0x10000) & 0xff;
    bytes[4] = (now / 0x100) & 0xff;
    bytes[5] = now & 0xff;

    // Version 7 in the high nibble of byte 6.
    bytes[6] = (bytes[6]! & 0x0f) | 0x70;
    // RFC 4122 variant (10xx) in the high bits of byte 8.
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;

    const hex = bytes.toString('hex');
    return (
        `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
        `${hex.slice(16, 20)}-${hex.slice(20, 32)}`
    );
}
