# MeterHub — Known Limitations (MVP)

Honest list of what the MVP does not do yet. Each item is a deliberate
scope cut or a known simplification, not a bug; most have a natural home in
later MVP phases (see the roadmap in README.md).

## Architecture and security

- **No service-to-service authentication.** Services trust requests on the
  internal Docker network; only the JWT from the client is verified. A
  compromised service could call any other service directly. Mitigation
  path: mTLS or service tokens for the mesh, per docs/conventions.md §15.
- **Single PostgreSQL container.** All four databases share one instance
  and one volume — no fault isolation between services. The schema design
  (one database per service, one user per database) keeps the migration to
  per-service instances mechanical (docs/conventions.md §11).
- **Household membership model is minimal.** Roles exist in the boundary
  design but the MVP only has owner-style membership via creation; there is
  no invite/accept flow, no member management API yet.
- **Access tokens cannot be revoked.** A stolen 15-minute access token
  stays valid until it expires; only refresh tokens are revocable (logout,
  rotation reuse detection). Fixing this needs a token blacklist/introspection
  step in the validation path.

## API and clients

- **No pagination metadata.** Reading history takes `limit`/`offset` and
  returns a bare array — no total count, no next/prev links, and limits are
  not capped, so a huge `limit` returns a huge response.
- **No rate limiting.** The gateway design reserves the concern
  (docs/service-boundaries.md) but no per-client limits are enforced; login
  and register are brute-forceable locally.
- **No idempotency keys.** Retried POSTs (readings especially, on flaky
  networks) can create duplicates; clients must treat `409`/`422` as
  authoritative instead of blindly retrying.
- **Readings are manual only.** `source` is always `MANUAL`; no provider or
  device ingestion yet (that is the Provider/Device Services phase).

## Operations

- **No deployed scraper or dashboards.** Services expose Prometheus metrics
  and structured logs, but nothing scrapes/alerts/displays them yet —
  observability infrastructure is a later phase.
- **No CI/CD.** Nothing builds or tests automatically on push; tests run
  locally (per-service suites + `node --test e2e/journey.e2e.test.mjs`).
- **No backups or disaster recovery.** The compose volume is disposable by
  design (`docker compose down -v` wipes it); do not put real data in a
  local MVP stack.
- **Local HTTPS only via the web app's assumptions.** The gateway serves
  plain HTTP on 8080; TLS termination is assumed to happen at an ingress in
  real deployments and nowhere locally.
- **Hybrid dev mode is manual.** Running one service from the IDE against
  Docker postgres works (`docker compose up -d postgres` + per-service
  run config), but service-to-service calls expect default localhost ports —
  starting a single service in isolation needs the others running too, or
  the calls fail (ownership checks fail closed with 503, which is correct
  but can be surprising while debugging).

## Data

- **No soft delete or audit trail.** Deletes (where exposed) are hard;
  only `createdAt` timestamps exist, no `updatedAt`/actor tracking.
- **Timezone discipline is on the client.** All timestamps are UTC ISO-8601
  and services store UTC; nothing stops a client from submitting a
  `recordedAt` far in the past or future beyond basic format validation.
