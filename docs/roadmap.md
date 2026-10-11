# MeterHub — Roadmap

Status of the platform when this roadmap was written (2026-09-26):

- **MVP complete** — sign in → create household → add meter → enter reading →
  view history. Ownership authorization, refresh-token rotation, cross-user
  isolation, e2e journey test, clean-checkout acceptance verified.
- **Observability triad complete** — Prometheus + Grafana (spec 1), Jaeger
  tracing (spec 2), Loki + Promtail logs (spec 3).
- **CI/CD** — tests + e2e on every PR, images published to ghcr.io on green
  `main`, Portainer pull-based deploy.
- **Gateway hardening started** — per-client token-bucket rate limiting.

Phases are sequenced so each one is shippable on its own and keeps the
platform running end to end. The PRD (§15) sketched Reminders →
Notifications → Providers → Devices → distributed experiments; this
roadmap changes that order in two ways:

- **The async backbone (Kafka, outbox) is pulled forward** — Reminders and
  Notifications both want event-driven delivery, so the backbone is built
  once, before the features that depend on it, rather than retrofitted
  twice.
- **Provider Service is split: a thin core goes first.** A reminder is a
  provider requirement ("submit between the 20th and the last day"), so
  the provider/account/window model precedes Reminders, and the provider
  *integrations* (adapters, submission) stay later. The order is
  Provider core → Reminders → Notifications → Provider integrations →
  Devices.

---

## Phase 1 — Hardening & Platform Maturity

Close the operational gaps tracked in `docs/backlog.md` (items A1, A3, A4, O1–O3, D1; C1–C3 and D2 already resolved) before adding
features. Everything here is within the existing five-service topology —
no new services.

### 1.1 API surface fixes

- **Pagination metadata.** Reading history (and list endpoints generally):
  return a `{items, total, limit, offset}` envelope, cap `limit`
  server-side, add next/prev links or cursor. Contract + generated clients
  update together.
- **Idempotency keys.** `POST /readings` (and other retried POSTs) accept
  `Idempotency-Key`; duplicate submissions within a window return the
  original response instead of creating a second reading.
- **Input sanity on `recordedAt`.** Reject readings far in the past/future
  (configurable tolerance) instead of accepting anything format-valid.

### 1.2 Security

- **Access-token revocation.** Blacklist or introspection step in the
  validation path so a stolen 15-minute token can be killed before expiry
  (logout-everywhere, password change).
- **Household membership model.** Implement the designed
  OWNER / MEMBER / VIEWER roles: invite → accept flow, member management
  API (`POST /households/{id}/members`, `DELETE .../members/{userId}`),
  role-aware ownership checks in Meter/Reading services.
- **Service-to-service authentication.** Service tokens or mTLS on the
  internal network per conventions §15 — currently any compromised
  container can call any other service directly.

### 1.3 Operations

- **Alerting.** Alertmanager + rules on the existing Prometheus (scrape
  target down, sustained 5xx, readiness flapping) and Loki alerts (error
  spikes); notification path (Telegram is the natural first channel —
  reuse it in Phase 5). This closes the last unchecked item in
  `1_metrics_observability_tasks.md` besides per-service dashboards.
- **Backups.** Scheduled `pg_dump` per database to a host volume; document
  restore. The Compose volume is currently disposable by design.
- **Soft delete / audit fields.** `updatedAt` + actor tracking where
  mutations exist; replace hard deletes with archived/expired states for
  household and meter lifecycle.
- **TLS termination.** Decide the ingress story for the Portainer host
  (reverse proxy with certs, or gateway-level TLS) so LAN deployments
  aren't plain HTTP.
- **Per-service drill-down dashboards** in Grafana if the overview
  proves insufficient.

### 1.4 Deferred until proven needed

- Shared rate-limit store (Redis) — in-process token buckets (backlog C2,
  resolved) are correct for the single-instance gateway; only when the
  gateway scales past one instance.
- Per-service PostgreSQL containers — schema design already keeps the
  migration mechanical (conventions §11).

**Done when:** pagination + idempotency shipped and covered by the e2e
test; membership roles enforced end to end; Alertmanager fires a real
notification; backups restore-tested at least once.

---

## Phase 2 — Async Backbone (Kafka)

New infrastructure, no user-facing features — this is the PRD's
"distributed-system experiments" phase, done early because everything
after it consumes events.

- **Kafka in Compose** (port 9092 reserved in `docs/ports.md`), single
  broker, dev-grade.
- **Outbox pattern** in Reading Service: `ReadingCreated` (and later
  `MeterCreated`, `HouseholdCreated`) written transactionally with the
  aggregate, published by a relay.
- **Idempotent consumers** — stable event IDs, dedup on the consumer side
  (conventions §15, README development principles already require this).
- **Retry topics / dead-letter topics** with a documented policy.
- **Contracts** — event schemas under `contracts/events/` (directory
  already reserved).
- **Observability hookup** — consumer lag metrics scraped, trace
  propagation through produce/consume so a reading shows up as one
  waterfall including the async leg.

**Done when:** a reading creation produces `meter.reading.created` via the
outbox, a demo consumer processes it idempotently, a poisoned message ends
in the DLQ, and the lag dashboard shows the consumer group.

---

## Phase 3 — Provider Service (core) & System Roles

Reminders are driven by what a provider requires, not by a per-meter
preference: each provider wants readings inside a window (e.g. "between
the 20th and the last day of the month"). The provider relationship —
not the meter — therefore owns the rule, and Meter Service never learns
provider specifics (`docs/service-boundaries.md` §7). This phase builds
the **thin core** of Provider Service — no integrations yet — so
Reminders consume a real model instead of inventing and later migrating
one. Spec: [spec 6](spec/6_provider_service_spec.md).

Two independently shippable epics, in order:

**System roles (Identity Service)** — the prerequisite for a curated
provider list, since nobody can be an administrator today.

- **`USER` / `ADMIN` system roles**, separate from household
  `OWNER`/`MEMBER`/`VIEWER`; a `roles` claim in the access token and on
  `GET /users/me`.
- **Admins declared by deployment** (`IDENTITY_ADMIN_USER_IDS`, by user ID
  — registration is unverified, so never by email), reconciled at identity
  startup; no grant API yet.
- `ADMIN` is catalog-only: no access to any household's data.

**Provider Service**

- **Provider Service** (port 8086, own `provider_db`, NestJS) owning
  `Provider`, `ProviderAccount` and the meter→account binding — the
  boundary already documented in `docs/service-boundaries.md` §7.
- **Unified provider catalog + private providers** — admin-curated global
  providers every household picks from, plus household-private ones so a
  missing provider never blocks anyone; admins can promote a private
  provider into the catalog, and accounts can be re-pointed to resolve
  duplicates.
- **Submission-window rule on the account** (a catalog provider may supply
  a default window that is copied at creation, never a live link): window
  start and end (day-of-month or "last day"), timezone, monthly cycle.
  Calendar edge cases are decided in the spec; one pure window function
  serves the API and Reminders.
- **Manual providers are first-class** — a provider with no integration,
  where the user submits readings themself, is the case reminders exist
  for.
- **Binding with validity dates** — a meter can move to another provider
  over time (supplier switch); bindings carry `validFrom`/`validTo`.
- **Events** — `provider.account.changed` / `provider.binding.changed`
  state snapshots under `contracts/events/`, published through the outbox,
  so Reminders can react to rule changes.
- **UI** — provider picker, account and binding management, catalog admin
  screen for admins.

**Done when:** an admin can curate the catalog; a household can create an
account from a catalog provider with a submission window, bind a meter to
it, and the rule and binding changes appear as events on the backbone.

---

## Phase 4 — Reminders

The first feature phase built on the event backbone (PRD §15 Phase 2),
now driven by Phase 3 provider rules.

- **Reminder generation** from the submission-window rule of each bound
  meter's provider account — new bounded context, new service or a module
  of Provider Service (decide by boundary, per
  `docs/service-boundaries.md`).
- **Background scheduler** evaluating rules and emitting reminder-due
  events (lead times, e.g. 3 days before the window closes, on the last
  day, then overdue).
- **Reminder state machine** — due → sent → acknowledged / overdue;
  delivery tracking per reminder.
- **Automatic acknowledgement** — a `meter.reading.created` event for a
  bound meter inside the window closes the reminder; nobody has to tap
  "done".
- **UI** — upcoming/overdue reminders per meter and provider.

**Done when:** a provider rule produces a reminder event on time, a
reading inside the window acknowledges it automatically, and the UI shows
upcoming/overdue reminders.

---

## Phase 5 — Notifications (Notification Service)

The first consumer of the backbone beyond demos (PRD §15 Phase 3).

- **Notification Service** (next port in the 8085+ block, own
  `notification-db`) consuming reminder events.
- **Telegram bot** as the first channel (also serves as the alerting
  channel from Phase 1.3 — one bot, two uses).
- **Email** channel second.
- **Notification preferences** per user — channel opt-in/out, quiet hours.
- **Delivery tracking** — notification records with status/retries;
  idempotent sends.

**Done when:** a due reminder arrives in Telegram, preferences are
respected, and a failed send retries without duplicating delivery.

---

## Phase 6 — Provider Integrations

Extends the Phase 3 Provider Service; the model and boundary already
exist, this phase adds the outbound side.

- **Provider adapter abstraction** — first real provider, plus a
  configurable generic HTTP provider.
- **Submission flow** — reading-confirmed events trigger submission;
  retry + failure handling with visible status per submission.
- **UI** — provider account credentials/linking, submission status per
  reading.

**Done when:** a reading can be submitted to a (test) provider account
automatically, with retries and a visible audit trail.

---

## Phase 7 — Device Automation (Device Service)

- **Device Service** — registration, `lastSeen` health, device→meter
  binding.
- **MQTT ingestion** (broker in Compose) from ESP32-class devices;
  `DEVICE` reading source (the enum value already exists).
- **Automatic reading ingestion** into Reading Service via events —
  Reading Service stays device-agnostic per its boundary.
- **Device health** — last-seen dashboards, offline alerts (reusing
  Phase 1 alerting).

**Done when:** a device pushes a reading end to end without manual entry,
and a silent device raises an alert.

---

## Phase 8 — Scale-out Experiments

Only when something above actually needs it — each item is deliberately
optional:

- **Gateway scale-out** — Redis-backed rate-limit buckets, multiple
  gateway instances behind a proxy.
- **Per-service PostgreSQL instances** — mechanical by design; do it to
  validate the claim.
- **Kubernetes** — the Portainer deploy is the honest baseline; K8s is an
  experiment, not an upgrade, for this project's scale.
- **Long-term metrics/log storage, auth on the observability plane** —
  revisit if any deployment leaves the LAN.

---

## Cross-cutting rules for every phase

Carried from the PRD, conventions, and Definition of Done (conventions
§18–19) — each new service or capability ships with:

1. Bounded-context + data-ownership documentation in
   `docs/service-boundaries.md`
2. OpenAPI/event contracts under `contracts/`
3. Next port in the plan, Compose entry, `.env.example` variables
4. Health probes, structured logs, correlation ID, metrics — wired into
   the existing Grafana dashboards
5. Unit tests + e2e journey extension; CI green on PR
6. No direct access to another service's database, ever
