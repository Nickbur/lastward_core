# Lastward Continuity Core

A minimal, self-contained, **self-hostable** server for **Lastward** — a
zero-knowledge digital **dead man's switch**. You arm a switch and check in on a
cadence; if you stop checking in and a safeguarded grace window elapses, the
switch *fires* and delivers what you left behind — a message, an encrypted file
or secret, a private page to chosen recipients, or a truly-public page.

This is the **AGPL-3.0 continuity core**: a second, independent implementation of
the same wire protocol as the Lastward cloud. Its reason to exist is **continuity** —
so the switches you set up **outlive any single company**. If the hosted service
ever goes away, you (or anyone) can run this and keep everything working.

The server is **blind by design**. It stores ciphertext and a passphrase-wrapped
content key; it never sees your passphrases or plaintext (the one exception is
content you explicitly mark *readable*, including public pages, which are plaintext
by nature). It knows only the metadata the fire engine needs: cadence, deadline,
recipient address, action type, and state.

> **License:** AGPL-3.0-only. The server core is AGPL so that any hosted
> derivative must share its source — the strongest trust signal for software that
> holds secrets. (The Lastward apps themselves are licensed separately.)

---

## Why this exists

A dead man's switch is only trustworthy if it cannot die with its operator. The
hosted Lastward service mitigates that with a standing encrypted export and a
published shutdown protocol — but the real escape hatch is **this**: a small,
auditable server anyone can run with one command. What you set up is portable and
survives the vendor.

---

## Quick start

```bash
cp .env.example .env
# edit .env — at minimum set a strong OWNER_TOKEN:
#   openssl rand -hex 32
docker compose up --build
```

That starts PostgreSQL and the server, applies the database migrations, and
listens on `http://localhost:8080`. The in-process sweep runs every
`SWEEP_INTERVAL_SECONDS` (default 60s), so switches warn and fire with no external
scheduler.

### Running without Docker

```bash
npm install
npm run build
DATABASE_URL=postgres://user:pass@localhost:5432/lastward \
OWNER_TOKEN=$(openssl rand -hex 32) \
  npm run db:migrate      # apply migrations
npm start                 # start the server
# or run the sweep once from cron instead of the in-process interval:
#   node dist/sweep.js
```

---

## Authentication (single-tenant)

This core is **single-tenant**: there are no user accounts, sign-ups, projects, or
entitlements — everything is unlimited. The one owner authenticates with a static
bearer token set in `OWNER_TOKEN`:

```
Authorization: Bearer <OWNER_TOKEN>
```

Every `/v1/switches*` route requires it. The public release and public-page routes
are unauthenticated (they are token- and slug-scoped instead).

Use a strong, random token — a weak one means anyone could disarm or reconfigure a
dead man's switch.

---

## API

All JSON routes are under `/v1`. Timestamps are ISO-8601; bodies are camelCase.

### Owner API (bearer-gated)

| Method & path | Purpose |
|---|---|
| `GET /v1/switches` | List all switches (config + server state, recipients, actions). |
| `GET /v1/switches/:id` | One switch. |
| `PUT /v1/switches/:id` | Create/replace a switch **config** by client UUID (nested recipients + actions). Server computes `nextDeadline`; `state`/`armedAt`/`firedAt` are not client-writable. |
| `DELETE /v1/switches/:id` | Delete a switch (idempotent; cascades). |
| `POST /v1/switches/:id/checkin` | Proof of life — resets the deadline, re-activates. |
| `POST /v1/switches/:id/disarm` | Turn the switch off (reversible via check-in). |
| `PUT /v1/switches/:id/actions/:actionId/payload` | Upload the encrypted (or readable) payload for one action. |

A switch's safety config: a **cadence** (`{value, unit: day|week|month}`), a
**grace** window (`{value, unit: hour|day}`, floored at **48 hours**), and a
**warnings** escalation schedule (each `{offsetHours, channels}`; at least `push` +
`email` must appear). These floors are enforced at write time and again in the
sweep.

A **payload** is either zero-knowledge (`mode: "zk"` with
`ciphertext`/`wrappedKey`/`salt`/`nonce`/`algo`, or a `blobRef` for large files) or
`readable` (server-composed plaintext — only for a `message` or a `public_page`).

### Public routes (no auth)

| Method & path | Purpose |
|---|---|
| `GET /v1/release/:token` | The content-blind JSON bundle for a recipient of a **fired** switch to decrypt in-browser. 404 for an unknown/expired token or an unfired switch. |
| `GET /release/:token` | A self-contained HTML release page (what fire emails link to): renders readable content immediately and decrypts ZK items in the browser. |
| `GET /p/:slug` | A published **public page** (see below). |
| `GET /health` / `GET /v1/health` | Liveness. |

---

## The self-host-only `public_page` action

Lastward supports five action types: `message`, `file`, `secret`, `private_page`,
and **`public_page`**. The hosted cloud **refuses** `public_page` — a truly-public,
indexable "leak" page is incompatible with zero-knowledge (public means
plaintext-at-fire) and makes the host a publisher of whatever it contains.

**This self-host build accepts it** — that is the whole point of running your own
instance. When a switch with a `public_page` action fires, the sweep publishes the
page's plaintext content at `GET /p/:slug` (the slug comes from the action config,
or is generated). The page is public and indexable, and — unlike encrypted
payloads — it is **not** removed by the retention purge: a published leak is meant
to stay up. **The publishing liability sits entirely with you, the self-hoster.**

---

## How firing works

The switch **state and deadline are server-authoritative** — a client device may
be offline through the entire grace window, so firing is decided here, not on the
device. The sweep (`src/sweep.ts`, run in-process or from cron):

1. Transitions `active → grace` once the check-in deadline passes.
2. Escalates the **due warnings** to the owner. Email is delivered via SMTP (or the
   console without SMTP); **push and SMS are console-only** — the core ships no
   OneSignal/Twilio, so you can wire your own provider. Owner warning emails go to
   `OWNER_EMAIL` when set.
3. Once the grace window (≥ 48h floor) elapses, **fires**: publishes any public
   pages, then emails each recipient a tokenized release link (for ZK items) plus
   any readable messages inline.
4. Every delivery is **claimed** in an idempotency ledger before it is sent
   (unique per `switch + kind + step`), and a failed *fire* delivery releases its
   claim so a later sweep retries it — crashes, overlaps, and catch-up runs never
   double-send.
5. Purges expired release tokens and the payloads of switches fired past
   `FIRE_RETENTION_DAYS`.

### Reference crypto envelope

The server is crypto-blind, but the bundled HTML release page includes an
in-browser reference decryptor for the envelope
`algo = "xchacha20poly1305-argon2id-v1"`:

```
KEK        = crypto_pwhash(32, passphrase, salt, INTERACTIVE, INTERACTIVE, ARGON2ID13)
contentKey = crypto_secretbox_open(wrappedKey[24:], wrappedKey[:24], KEK)
plaintext  = crypto_aead_xchacha20poly1305_ietf_decrypt(ciphertext, nonce, contentKey)
```

with `salt`/`wrappedKey`/`nonce`/`ciphertext` all base64. A client that uses a
different envelope should point its own release UI at `GET /v1/release/:token` —
the server stores and returns ciphertext verbatim either way.

---

## Configuration

See `.env.example` for the full list. Essentials:

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | — (required) | PostgreSQL connection string. |
| `OWNER_TOKEN` | — (required, ≥16 chars) | Bearer token for the owner API. |
| `PUBLIC_URL` | `http://localhost:8080` | Base URL used in release + public-page links. |
| `SWEEP_INTERVAL_SECONDS` | `60` | In-process sweep cadence; `0` disables it (use cron). |
| `FIRE_RETENTION_DAYS` | `90` | Retention window for payloads + release links. |
| `OWNER_EMAIL` | — | Where owner warning emails go (else console-only). |
| `SMTP_*` | — | Optional SMTP delivery; without it, mail prints to the console. |

---

## Operator continuity

This server is itself the continuity guarantee, but run it like one:

- **Export your data regularly.** A plain `pg_dump` of the database captures every
  switch config, recipient, action, and ciphertext payload — a complete, portable
  backup independent of any host:
  ```bash
  docker compose exec db pg_dump -U lastward lastward > lastward-backup.sql
  ```
  Because payloads are stored as ciphertext, the dump is safe to keep offsite, and
  it is enough to stand up an identical instance elsewhere.
- **Publish your own shutdown protocol.** If *you* will stop operating an instance,
  give your recipients advance, multi-channel notice, a final export, and a pointer
  to this repository so they can self-host and keep the switches alive. The honest
  disclosure is that "a service outlives its operator" is only *partially* solved —
  open source + export is the escape hatch, not a magic guarantee.
- **Keep the passphrases out-of-band.** The server can never recover a ZK
  passphrase. Make sure your recipients can obtain theirs even if you are gone.

---

## Development

```bash
npm install
npm run build        # tsc → dist/ (NodeNext ESM)
npm run typecheck    # tsc --noEmit
npm run dev          # tsx watch src/server.ts
npm run db:generate  # build, then drizzle-kit generate (new migration from schema)
npm run db:migrate   # apply migrations (tsx)
npm run sweep        # run the sweep once (tsx)
```

Stack: Node 20+, TypeScript (ESM, NodeNext), Fastify 5, Drizzle ORM + PostgreSQL,
Zod, nodemailer, date-fns.
