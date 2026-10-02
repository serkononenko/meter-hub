# MeterHub — Known Limitations Backlog

Honest list of what the MVP does not do yet. Each item is a deliberate scope cut or a known simplification, not a bug. Every limitation is tracked here as a backlog item with an ID, impact, resolution path and roadmap phase (see [roadmap.md](roadmap.md)).

| Status | Meaning |
|---|---|
| **Open** | Scheduled in a roadmap phase, not started |
| **Accepted** | Deliberate cut with a defined revisit trigger; no phase assigned yet |
| **Resolved** | No longer true; kept for the record |

Last reviewed: 2026-09-27

---

## A — Architecture & security

| ID | Limitation | Impact | Resolution path | Phase | Status |
|---|---|---|---|---|---|
| A1 | No service-to-service authentication — services trust any request on the internal Docker network; only the client JWT is verified | A compromised service could call any other service directly | Service tokens / mTLS on the internal network, per [conventions.md](conventions.md) §15 | 1.2 | Open |
| A2 | Single PostgreSQL container — all four databases share one instance and one volume, no fault isolation | One instance failure takes down every service at once | Schema design (one database + one user per service) keeps migration to per-service instances mechanical ([conventions.md](conventions.md) §11) | 7 | Accepted — do it only when a deployment actually needs isolation |
| A3 | Household membership model minimal — roles exist in the boundary design, but MVP only has owner-style membership via creation | No invite/accept flow, no member management API; one user per household in practice | Invite → accept flow, member management API, role-aware ownership checks in Meter/Reading services | 1.2 | Open |

## C — API clients

All API-client items (C1–C3) are resolved — see the Resolved section.

## O — Operations

| ID | Limitation | Impact | Resolution path | Phase | Status |
|---|---|---|---|---|---|
| O1 | No alerting — observability stack (Prometheus, Grafana, Jaeger, Loki via Promtail) is deployed with provisioned dashboards, but nothing fires | Someone has to be looking at dashboards to notice a problem | Alertmanager + rules on existing Prometheus (target down, sustained 5xx, readiness flapping) and Loki alerts (error spikes); Telegram as first notification channel | 1.3 | Open |
| O2 | No backups / disaster recovery — the compose volume is disposable by design (`docker compose down -v` wipes it) | Real data must not live in the local MVP stack; a host deployment has no recovery story | Scheduled `pg_dump` to a host volume, documented and restore-tested restore procedure | 1.3 | Open |
| O3 | No TLS termination — the gateway serves plain HTTP on 8080; termination is assumed to happen at an ingress that doesn't exist locally | LAN deployments other than the web app's own assumptions are plain HTTP | Decide ingress story (reverse proxy with certs, or gateway-level TLS) for Portainer host deployments | 1.3 | Open |
| O4 | Hybrid dev mode is manual — running one service from the IDE against Docker Postgres works, but service-to-service calls expect default localhost ports | Starting a single service in isolation needs the others running too; calls fail closed with 503 (correct, but surprising while debugging) | Document a minimal per-service run matrix, or a Compose profile that starts only dependencies | — | Open — unscheduled |

## D — Data

| ID | Limitation | Impact | Resolution path | Phase | Status |
|---|---|---|---|---|---|
| D1 | No soft delete or audit trail — deletes (where exposed) are hard; only `createdAt` exists | No `updatedAt`, no actor tracking; accidental deletes are unrecoverable | `updatedAt` + actor tracking on mutations; replace hard deletes with archived/expired states for household/meter lifecycle | 1.3 | Open |

## F — Frontend

All frontend items (F1) resolved — see Resolved section.

---

## Resolved

| ID | Was | Resolved | Evidence |
|---|---|---|---|
| O5 | CI runs tests only — no image publishing, no environments | 2026-09-26 | Images published to ghcr.io on green `main` (`linux/amd64`, tagged `main`/`latest`/SHA); Portainer pull-based deploy documented in [deploy-portainer.md](deploy-portainer.md) |
| O6 | Reading source enum unresolved — clients could not assume what `source` values exist | 2026-09-26 | Contract pins `source` to `MANUAL` for the MVP (`contracts/openapi/services/reading-service/openapi.yaml`); `DEVICE` arrives with Phase 6 |
| C1 | No pagination metadata — history endpoints took `limit`/`offset` and returned a bare array, no total count, no links | 2026-09-27 | Offset-based `ReadingPage` envelope `{items, total, limit, offset}` in the reading contract; server clamps and echoes paging values; frontend and e2e updated (`ReadingPage` in `contracts/openapi/services/reading-service/openapi.yaml`) |
| D2 | Timezone discipline relied on the client — nothing stopped a `recordedAt` far in the past or future | 2026-09-27 | Reading Service rejects out-of-window timestamps with 422 `RECORDED_AT_IN_FUTURE` / `RECORDED_AT_TOO_OLD` (5-year window), enforced via `@DateNotInFuture` / `@DateNotOlderThan` command decorators |
| C3 | No idempotency keys — retried POSTs (readings especially, on flaky networks) could create duplicates; `409`/`422` were ambiguous duplicate signals | 2026-09-27 | `Idempotency-Key` on `POST /readings` (optional header, per-user scoped): repeats within the 24h window replay the original response; reuse with a different body is 409 `IDEMPOTENCY_KEY_REUSE`; records stored in the reading DB with hourly cleanup cron. Web app sends one key per dialog session |
| C2 | Rate limiting was unimplemented, then implemented in-process — gateway token buckets (keyed by token subject / client IP, [service-boundaries.md](service-boundaries.md) §Rate limiting) live in a single JVM instance: not shared across instances, reset on restart | Shipped and working for the single-instance gateway; buckets never evict idle keys (negligible at household scale) | Rate limiting itself is done — per-client token buckets via Bucket4j with separate tighter auth-endpoint buckets, `429` + `Retry-After` + problem body, covered by `GatewayRateLimitIntegrationTest`. The residual follow-up — a shared store (Redis) so buckets survive restarts and are shared when the gateway scales out — stays in scope for Phase 7 |
| A4 | Access tokens could not be revoked — a stolen 15-minute access token stayed valid until it expired | 2026-09-27 | Identity issues a `jti` claim and logout (optionally carrying the Bearer access token) records it in a new `revoked_access_tokens` table; the gateway polls identity's internal feed (`GET /api/v1/internal/revoked-access-tokens`, cursor-paginated) every 5s into an in-memory cache that the JWT validator chain consults — revocation takes effect within the poll interval instead of the token living out its TTL. Poll failures fail open (every token dies at `exp` anyway); rows are cleaned up daily once expired; the internal endpoint is never proxied (`denyAll` on the gateway path) and carries no auth yet — that trust gap is A1's scope. In-JVM cache mirrors the C2 rate-limiter tradeoff; shared store deferred to Phase 7 |
| O7 | Compose only healthchecked Postgres — `docker compose ps` showed all app services as plain `Up` even when a process was wedged, and `depends_on: service_started` let the gateway boot against services that weren't listening yet | 2026-09-27 | Liveness healthchecks on all five service containers (probe paths documented in the shared contract `contracts/openapi/openapi.yaml`); gateway/identity/household images gained curl; gateway and reading-service now `depends_on: service_healthy`. Liveness only, per conventions §13: no readiness or peer-service probes, so a dead dependency can't cascade restarts. Surfaced and fixed a latent journey-test/rate-limiter interaction (12 auth calls vs the 10-capacity IP bucket — tests now present distinct `X-Forwarded-For` clients) |
| F1 | Sign-up form never submitted: the `submit` callback's `useCallback` deps omitted `values`, so validation always saw the initial empty strings — "Email is required" on a full form, submission impossible | UI-only registration (and any scripted/e2e drive of it) was blocked | 2026-10-02 | Fixed the deps and replaced both auth forms' hand-rolled validation with zod schemas (`src/lib/auth/schemas.ts`): email format, username pattern/length, password length, confirm-match refine; forms are `noValidate` so zod's messages render as MUI form helpers instead of native tooltips. Verified live (dev server): inline errors on bad email + password mismatch, valid submit fires `POST …/auth/register` (backend stack was down; request path confirmed via network log) |

---

## Done when

The Phase 1 slice of this backlog is done when: A3 roles enforced end to end (all C items already resolved); O1 fires a real notification; O2 restore-tested at least once (mirrors roadmap Phase 1 exit criteria). The remaining Accepted item (A2) revisits at its stated trigger in Phase 7, along with C2's scale-out follow-up.
