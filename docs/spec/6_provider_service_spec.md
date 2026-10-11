# Provider Service (Core) & System Roles — Specification

**Status:** Draft
**Version:** 0.2
**Parent:** [roadmap.md](../roadmap.md) Phase 3, [0_meter_hub_mvp_prd.md](0_meter_hub_mvp_prd.md) §15 (provider integrations, split — see roadmap intro)
**Depends on:** Spec 4 (household access verdict), Spec 5 (outbox + event contracts)
**Feeds:** Phase 4 Reminders (consumes the events and windows defined here), Phase 6 Provider Integrations (extends this service)

Task breakdown: [../tasks/6_provider_service_tasks.md](../tasks/6_provider_service_tasks.md).
It splits this spec into two independently shippable epic groups:
**system roles** (§5, identity-service only) first, then **Provider Service** (§4, §6–§10).

## 1. Overview

A utility provider requires readings inside a specific window — "between
the 20th and the last day of the month". That requirement belongs to the
provider relationship, not to a meter and not to a user's personal
preference: ten meters on one provider share one rule, and when the
provider changes its window it changes in one place.

Today MeterHub has no provider concept at all. This phase introduces
**Provider Service** with only the thin core Reminders need: who the
provider is, which account the household holds with it, what its
submission window is, and which meters belong to which account over time.
No integrations, no outbound submission, no credentials — those are
Phase 6 and extend this service rather than replace it.

Providers come from a **curated catalog**: a unified list of well-known
providers maintained by system administrators, which households pick from.
Because no one can be an administrator today, this phase also introduces
**system roles** in Identity Service (`USER`, `ADMIN`) — a concept
deliberately separate from household membership roles
(`OWNER`/`MEMBER`/`VIEWER`, spec 4). Households can still create their own
private providers, so a provider missing from the catalog never blocks them.

The boundary from `docs/service-boundaries.md` §7 holds: Meter Service
never learns provider specifics. The meter→provider link lives here, keyed
by a plain meter UUID, exactly as Reading Service references meters.

## 2. Goals

- One curated list of providers shared by every household, managed by
  administrators; households choose from it instead of re-typing the same
  provider and creating near-duplicates ("Energy Co" / "EnergyCo").
- Identity Service can say who is a system administrator, in the access
  token, without any other service needing to learn identity internals.
- A household can still add a private provider when the catalog lacks one.
- A household can describe its accounts with a provider and state each
  account's submission window (opens/closes day, timezone). A catalog entry
  may suggest a default window that pre-fills the account.
- A meter is bound to at most one account at a time; moving to another
  provider (supplier switch) keeps history via validity dates.
- Manual providers are first-class: nothing here requires an integration.
- Given a meter and a moment, the service answers "what is the current or
  next submission window?" — one implementation of the calendar rules, so
  Reminders (Phase 4) and the UI never recompute them differently.
- Rule and binding changes are published as events through the outbox, so
  Reminders can react without polling.
- Authorization is role-aware from day one (system roles for the catalog,
  household roles for everything else) and mutations are attributed and soft
  (backlog D1 lessons): no hard deletes, actor columns on every table.

## 3. Non-Goals

- Provider integrations, adapters, submission flow, credentials or secrets
  (`ProviderIntegration` — Phase 6). Account rows hold **no** credentials.
- Generating reminders or evaluating "is this window satisfied" (Phase 4).
- Notification delivery (Phase 5).
- An admin UI or API for granting/revoking system roles — admins are
  configured by deployment (§5.3). A self-service grant flow can come later.
- Fine-grained admin permissions: one `ADMIN` role, no sub-scopes.
- Admin access to household data. `ADMIN` is a **catalog** role only: it
  grants no read or write access to any household's accounts, bindings,
  meters or readings. Household authorization stays membership-based.
- An automated merge tool for duplicate providers. Duplicates are resolved
  by re-pointing accounts to the catalog entry (§6.1); no bulk migration.
- Business-day and public-holiday calendars — windows are calendar days.
- Cycles other than monthly (the schema carries `cycle`; only `MONTHLY` is
  accepted this phase).
- Tariffs, billing, cost.

## 4. Domain model

```text
                Provider (catalog)              Provider (private)
                 householdId = null             householdId = H
                 defaultRule?                   defaultRule?
                         \                      /
                          \                    /
Household (household-service)   ProviderAccount ──── 0..* MeterBinding ──── Meter (meter-service)
   (accounts belong to a          label, accountNumber,   meterId, validFrom,
    household H)                  submission rule         validTo (null = open)
```

- **Provider** — `id`, `householdId` (**null = global catalog entry**),
  `name`, `notes`, optional `defaultRule` (a suggested submission rule, §5
  shape), `archivedAt`.
  - *Global* providers are created and edited by `ADMIN` only and are visible
    to every authenticated user.
  - *Private* providers belong to one household, are managed by its MEMBER+
    users, and are visible to that household only.
  - The two kinds are one table and one type; scope is data, not code.
- **ProviderAccount** — the household's relationship with a provider: `id`,
  `providerId`, `householdId` (always set — the account is always private to
  its household, even when the provider is global), `label` /
  `accountNumber` (free text, user-facing), the **submission rule** (§5),
  `version`, `archivedAt`.
  The rule sits on the account rather than the provider because one provider
  commonly wants different windows for different utilities (electricity by
  the 20th, water by the 25th). A provider's `defaultRule` is only a
  **template copied into the account at creation** — never a live link, so
  an admin editing the catalog cannot silently move anyone's deadline.
- **MeterBinding** — `id`, `accountId`, `householdId`, `meterId`,
  `validFrom` (date), `validTo` (date, nullable = open-ended). Bindings are
  never deleted: ending one sets `validTo`.
- Every table carries `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
  (JWT subject) from the first migration.

Invariants:

- An account's provider must be **visible to the account's household**:
  global, or private to that same household (`422 HOUSEHOLD_MISMATCH`
  otherwise). Archived providers cannot be chosen for new accounts but keep
  serving existing ones.
- A meter has **at most one** binding live on any date: the open-ended
  binding is guarded by a partial unique index (`meter_id WHERE valid_to IS
  NULL`); overlap with closed bindings is rejected by a check inside the
  creating transaction. Violation → `409 METER_ALREADY_BOUND`.
- A binding's meter and its account must belong to the same household
  (`422 HOUSEHOLD_MISMATCH`).
- Archiving an account that still has an open binding is rejected
  (`409 ACCOUNT_HAS_ACTIVE_BINDINGS`) — end the bindings first, so the
  intent is explicit and Reminders never sees a bound-but-archived account.
- Archiving a *provider* with live accounts is allowed (existing accounts
  keep working; it only leaves the pick list) — the opposite of accounts,
  because a catalog cleanup must not be blocked by households' bindings.

## 5. System roles (Identity Service)

### 5.1 Model

System roles answer "what may this user do to the platform", not "what may
this user do in a household". Two values:

| Role    | Meaning                                                                 |
|---------|-------------------------------------------------------------------------|
| `USER`  | Every account. No platform-level powers.                                |
| `ADMIN` | Manages the global provider catalog (§6.1). Nothing else, this phase.   |

- `users.role` column, `VARCHAR(20) NOT NULL DEFAULT 'USER'` with a
  `CHECK (role IN ('USER','ADMIN'))`, in a new Flyway migration (existing
  rows become `USER`). Domain type `SystemRole`, kept distinct from
  household `MembershipRole` in names and docs.
- A single role per user (not a set) — enough for one privileged role; the
  token claim is an array so a future second role is not a breaking change.

### 5.2 Token and API

- Access tokens gain a **`roles` claim**, always present, e.g.
  `["USER"]` or `["USER","ADMIN"]`. `AccessTokenIssuer.issue` takes the
  user's roles, not just the subject (today it takes only the `UUID`).
- Refresh already reloads the user from the database before reissuing
  (`AuthService.refresh`), so a role change appears in the **next token the
  user obtains** — at the latest one access-token TTL (15 min) after the
  change, or immediately after re-login.
- `GET /api/v1/users/me` and the `User` schema gain `roles`; the frontend
  reads it to decide whether to show the catalog admin screen. Hiding is
  cosmetic — services enforce.
- Only Provider Service reads the claim this phase. Gateway, Household,
  Meter and Reading Service ignore it (they keep reading `sub`); business
  authorization stays in the owning service
  ([service-boundaries.md](../service-boundaries.md) §Authorization Boundary).
- **Revocation of a stale admin token:** demotion is eventually consistent
  (≤ one TTL). If that is too slow for an incident, A4's `jti` revocation
  already kills a specific token; no new mechanism is added.

### 5.3 Granting the role (deployment-configured)

No grant endpoint this phase. Administrators are declared by deployment:

- New identity-service setting `IDENTITY_ADMIN_USER_IDS` — comma-separated
  user UUIDs. On startup identity **reconciles**: listed users become
  `ADMIN`, any other `ADMIN` is set back to `USER`; every change is logged
  with the user ID. The environment is the source of truth, so removing an
  ID demotes (their access dies within one TTL, §5.2).
- Chosen **by user ID, not by email**: registration performs no email
  verification, so "promote whoever registers `boss@…`" would let anyone
  claim admin by registering that address first. A user ID is unguessable
  and known only after the account exists — register, read your ID from
  `/users/me`, add it to the env, redeploy/restart identity.
- Documented in `docs/deploy-portainer.md` and the env examples
  (`.env.example`, `stack.env.example`).
- Startup reconciliation touches only the `role` column, in one
  transaction; an ID with no matching user is logged and ignored (not an
  error — the env may be ahead of the data).

## 6. Provider Service — functional requirements

Contract-first: `contracts/openapi/services/provider-service/openapi.yaml`,
clients regenerated for the frontend (Orval) and NestJS consumers.

### 6.1 Providers (catalog and private)

- `POST /api/v1/providers` — body `{scope: GLOBAL|HOUSEHOLD, householdId?,
  name, notes?, defaultRule?}`. `GLOBAL` needs `ADMIN` (and no
  `householdId`); `HOUSEHOLD` needs `householdId` and MEMBER+.
- `GET /api/v1/providers?householdId=` — the pick list: every global
  provider **plus** that household's private ones, each marked with
  `scope`. `scope=GLOBAL` alone returns just the catalog (for the admin
  screen). `includeArchived=true` for history. Any role.
- `GET /api/v1/providers/{providerId}` (visible providers only, otherwise
  `404`).
- `PATCH /api/v1/providers/{providerId}` — rename, notes, `defaultRule`,
  archive via `archived: true`. Global: `ADMIN`. Private: MEMBER+. No
  `DELETE`.
- `POST /api/v1/providers/{providerId}/promote` — `ADMIN` only: turns a
  private provider into a global one (`householdId` → null). The
  originating household's accounts keep pointing at it, so nothing breaks.
  This is how a household's useful private provider enters the catalog.
  Rejects an already-global provider (`409 PROVIDER_ALREADY_GLOBAL`).
- Admin actions are attributed (`updatedBy`) and structured-logged with the
  admin's subject — the catalog is shared state, so who changed it matters.

### 6.2 Accounts

- `POST /api/v1/provider-accounts` — `{providerId, householdId, label,
  accountNumber?, rule?}` (MEMBER+). If `rule` is omitted and the provider
  has a `defaultRule`, that rule is copied; if neither exists the request is
  `422 INVALID_SUBMISSION_RULE`.
- `GET /api/v1/provider-accounts?householdId=` / `?providerId=`,
  `GET .../{accountId}`, `PATCH` (label, rule, archive, and **`providerId`**
  — re-pointing an account to a different visible provider; this is the
  duplicate-resolution path: switch the account from "EnergyCo" to the
  catalog's "Energy Co" without recreating it or touching its bindings).
  Every `PATCH` that changes the rule or provider bumps `version`.

### 6.3 Bindings

- `POST /api/v1/meter-bindings` — `{accountId, meterId, validFrom?}`
  (`validFrom` defaults to today in the account's timezone) (MEMBER+).
  The meter is checked to exist and belong to the account's household by
  calling Meter Service with the caller's bearer token forwarded — the same
  request-scoped `MetersApi` client Reading Service uses for `POST /readings`
  (`meter-api.provider.ts`). Meter Service stays unchanged.
- `GET /api/v1/meter-bindings?meterId=` (history, newest first) or
  `?accountId=` (any role).
- `PATCH /api/v1/meter-bindings/{bindingId}` — end it: `{validTo}`
  (MEMBER+). `validTo` may not precede `validFrom`; re-binding the meter to a
  different account afterwards is a new binding (supplier switch =
  end old, create new, same day allowed).

### 6.4 Submission windows

- `GET /api/v1/submission-windows?meterId=&at=` (any role) → the binding in
  force at `at` (default now) and `{current?, next}` windows computed with
  §7, each `{opensAt, closesAt, accountId, providerId}`. A meter with no
  live binding answers `200` with an empty body, not `404` — "no provider"
  is a normal state, and the UI renders it as such.
- Internal variant for Reminders (Phase 4), on the same `permitAll`-until-A1
  surface as the other internal endpoints, gateway `denyAll`:
  `GET /api/v1/internal/submission-windows?accountId=&from=&to=` → windows
  overlapping the range. Defined here so Phase 4 does not duplicate the
  calendar logic; shipped only if Phase 4's spec still wants it (§13 D3).

### 6.5 Authorization

Two independent checks, resolved per request at the top of each handler:

- **System role** — read from the JWT `roles` claim by Provider Service's own
  auth guard (extending the `{userId}` request user with `roles`, like the
  Meter/Reading Service guard).
- **Household role** — the household access verdict from Household
  Service's internal endpoint, 30 s verdict cache (spec 4), exactly as
  Meter Service does.

| Action                                              | Needed                 |
|-----------------------------------------------------|------------------------|
| Read global providers                               | any authenticated user |
| Read a household's private providers, accounts, bindings, windows | any member |
| Create/modify private providers, accounts, bindings | MEMBER+                |
| Create/modify/archive/promote **global** providers  | `ADMIN`                |

`ADMIN` confers nothing on household data: an admin who is not a member of
household H gets the same enumeration-safe `404` as any outsider.
Errors reuse the established codes: non-member → `404`, wrong household role →
`403 FORBIDDEN_ROLE`, non-admin touching the catalog →
`403 FORBIDDEN_SYSTEM_ROLE` (distinct code so the UI and logs can tell the
two role systems apart).

### 6.6 Frontend

- Provider picker when creating an account: the catalog first, the
  household's private providers below, "Add my own" at the bottom.
- "Providers" section per household: accounts showing the window in plain
  language ("20th → last day, Europe/Kyiv"), archive, re-point provider.
- Account editor with the rule form (zod-validated, mirrors §7 validation),
  pre-filled from the provider's `defaultRule`.
- Meter view: current provider/account and the current-or-next window, or
  "No provider linked" with a link action; bind/unbind with end date.
- **Catalog admin screen** (route visible only when `/users/me` returns
  `ADMIN`): list global providers, create, edit default window, archive,
  and a "private providers in use" view with a promote action. Server
  enforces; hiding is convenience.
- `VIEWER` sees everything, writes are hidden (spec 4 pattern).

## 7. Submission-window rule

```jsonc
{
  "cycle": "MONTHLY",                       // only value accepted this phase
  "opens":  { "kind": "DAY_OF_MONTH", "day": 20 },
  "closes": { "kind": "LAST_DAY", "offsetDays": 0 },
  "timezone": "Europe/Kyiv"                 // IANA zone
}
```

A *day spec* is one of:

- `{kind: DAY_OF_MONTH, day: 1..31}`
- `{kind: LAST_DAY, offsetDays: 0..27}` — the last day of the month minus
  `offsetDays` ("3 days before month end" = `offsetDays: 3`).

Evaluation for the **cycle month M** (the month the window *opens* in):

1. Resolve `opens` in M: `DAY_OF_MONTH` days beyond the month's length
   **clamp to the last day** (31 in February = 28/29).
2. Resolve `closes` in M the same way. If the resolved closing day is
   **before** the opening day, the window closes in month **M+1** (a window
   wrapping the month boundary, e.g. open the 25th, close the 5th) —
   `closes` is then resolved in M+1.
   Equal days = a single-day window.
3. `opensAt` = 00:00 local on the opening date; `closesAt` = 00:00 local on
   the day *after* the closing date (exclusive upper bound — the whole
   closing day counts). Local dates are converted to instants with the
   rule's timezone **after** calendar arithmetic, so DST transitions cannot
   shift a day boundary.

Validation (`422 INVALID_SUBMISSION_RULE`): unknown timezone, `day` out of
range, a window longer than the cycle (e.g. opens the 5th, closes the 4th
of the same cycle's next month), unsupported `cycle`. A provider's
`defaultRule` is validated by the same function when saved.

The window function is pure — `windowFor(rule, cycleMonth) → {opensAt,
closesAt}` — table-tested in isolation (leap years, 30/31-day months,
wrapping windows, DST zones, `LAST_DAY` with offsets). It is the single
implementation behind the API in §6.4 and any internal consumer.

## 8. Events

Published through an outbox in this service's own database, same pattern as
Reading Service (spec 5 §5): row written in the same transaction as the
change, relay publishes, consumers dedup by `eventId`.

Both events are **state snapshots** (event-carried state transfer): the
event holds the full current record, not a delta. A consumer can rebuild its
view from any sequence of them, tolerate redelivery, and ignore stale ones
using `version`.

| Topic                      | Key         | Emitted when                                                       |
|----------------------------|-------------|--------------------------------------------------------------------|
| `provider.account.changed` | `accountId` | account created, rule/label/provider changed, archived             |
| `provider.binding.changed` | `meterId`   | binding created or ended                                           |

- Contracts: `contracts/events/provider/account-changed.v1.schema.json` and
  `binding-changed.v1.schema.json`, TypeScript types generated like
  `reading-created`.
- `account.changed` carries `{accountId, providerId, householdId, version,
  rule, archived}`; `binding.changed` carries `{bindingId, accountId,
  householdId, meterId, validFrom, validTo, version}`. Both use the spec 5
  envelope (`eventId` == outbox id, `traceparent` captured from the request).
- `version` is a per-aggregate counter incremented on each change; per-key
  partition ordering plus `version` lets consumers discard out-of-order
  snapshots.
- **No catalog events** this phase: nothing downstream depends on provider
  names or default rules (accounts carry their own rule copy). Add one when a
  consumer needs it.
- Retry/DLQ policy is the shared consumer scaffolding's — nothing new here.

## 9. Service, data and operations

**Identity Service (system roles):** migration + token claim + `/users/me`
field + startup reconciliation (§5). New env `IDENTITY_ADMIN_USER_IDS`
(optional, empty by default = no admins) in `.env.example`,
`stack.env.example`, Compose and Portainer files.

**Provider Service:**

- **Stack:** NestJS + Prisma, like Meter and Reading Service — the outbox
  relay, Kafka producer, idempotency and household-verdict client are
  already written in that stack and are reused/copied rather than re-built
  in Java (§13 D4).
- **Port / DNS:** `provider-service`, **8086** (next after events-demo 8085).
- **Database:** `provider_db`, user `provider_user`, created by the Postgres
  init script; env vars `PROVIDER_DB`, `PROVIDER_DB_USER`,
  `PROVIDER_DB_PASSWORD` in `.env.example` / `stack.env.example`.
- **Gateway:** new routes for `/api/v1/providers/**`, `/provider-accounts/**`,
  `/meter-bindings/**`, `/submission-windows/**`; `/api/v1/internal/**`
  stays `denyAll`. Route ordering is checked against the existing
  `/api/v1/meters/**` routes (this service deliberately avoids that prefix).
  The gateway does **not** gain role checks.
- **Compose:** entry in `docker-compose.yml` and `docker-compose.portainer.yml`,
  liveness healthcheck, `depends_on` postgres/kafka `service_healthy`,
  `.npmrc` handling per the existing NestJS services.
- **Observability:** `/metrics` scraped by Prometheus, rows added to the
  existing Grafana overview, structured logs with correlation ID (Loki),
  traces to Jaeger, outbox lag metric as in Reading Service.
- **CI:** unit tests (window function table tests, binding invariants,
  authorization matrix across both role systems), e2e journey extension,
  image published like the other services.

## 10. Error semantics

- `404 PROVIDER_NOT_FOUND` / `PROVIDER_ACCOUNT_NOT_FOUND` /
  `METER_BINDING_NOT_FOUND` (also the mask for non-members, and for private
  providers of other households).
- `403 FORBIDDEN_ROLE` — household VIEWER writing.
- `403 FORBIDDEN_SYSTEM_ROLE` — non-admin writing to the global catalog.
- `409 METER_ALREADY_BOUND` — overlapping binding for the meter.
- `409 ACCOUNT_HAS_ACTIVE_BINDINGS` — archiving an account with open bindings.
- `409 PROVIDER_ALREADY_GLOBAL` — promoting a global provider.
- `422 INVALID_SUBMISSION_RULE`, `422 HOUSEHOLD_MISMATCH`,
  `422 METER_NOT_FOUND` (referenced meter unknown or not in the household).
- `503` when Household or Meter Service is unreachable — fail closed, as
  Meter Service does today.

## 11. Security & privacy

- **Privilege boundary:** `ADMIN` is catalog-only. It reads nothing of any
  household's accounts, bindings or meters, and the role is never consulted
  by household/meter/reading authorization.
- **Granting is out-of-band** (deployment env, §5.3) and keyed by user ID —
  not email — because registration is unverified.
- **Token staleness:** a demoted admin keeps catalog write access for up to
  one access-token TTL; `jti` revocation covers the urgent case.
- The `roles` claim is signed with the existing RS256 key and validated by
  the existing JWKS path — no new trust anchor.
- No credentials, tokens or portal logins are stored — deliberately; the
  secrets-handling design arrives with Phase 6 integrations.
- Account numbers are user-entered labels; they are returned only to
  household members and never logged (structured logger redaction like other
  PII fields).
- The internal windows endpoint exposes only rule-derived timestamps inside
  the A1 trust model, revisited when A1 lands.

## 12. Acceptance criteria ("done when")

**System roles**
- A user listed in `IDENTITY_ADMIN_USER_IDS` receives `roles: ["USER","ADMIN"]`
  in their access token after login/refresh and sees `ADMIN` on `/users/me`;
  an unlisted user gets `["USER"]`.
- Removing an ID from the env and restarting identity demotes the user; their
  next token has no `ADMIN` (verified through refresh).
- An unknown ID in the env is logged and ignored; registering with the
  "admin's email" confers nothing.

**Provider Service**
- An admin can create, edit, archive and promote catalog providers; a
  non-admin gets `403 FORBIDDEN_SYSTEM_ROLE` for each (through the gateway).
- Every household sees the catalog plus only its own private providers; a
  private provider of another household is `404`.
- An admin who is not a member of a household cannot read its accounts or
  bindings.
- A household member can create an account from a catalog provider (default
  window pre-filled), bind a meter, and re-point the account from a private
  duplicate to the catalog entry; a viewer can see but not change any of it.
- `GET /submission-windows` returns correct current/next windows for the
  edge cases in §7 (leap February, 31st clamped, `LAST_DAY` offsets, wrapping
  window, a DST zone).
- Ending a binding and binding the same meter to another account works and
  keeps both rows; two overlapping bindings are rejected under concurrency
  (race test against real Postgres, like the idempotency store).
- Account and binding changes appear as `provider.account.changed` /
  `provider.binding.changed` on the backbone, deduplicated on redelivery, and
  an out-of-order older `version` is detectably stale.
- Contracts + clients updated, Compose/Portainer/ports/env docs updated,
  service shows up in Grafana, `docs/service-boundaries.md` §2 (Identity:
  system roles) and §7 (Provider: from "Future" to the real boundary)
  updated, e2e journey extended, CI green.

## 13. Decisions to confirm

Drafted with recommended defaults; flip any before the task breakdown.

- **D1 — Hybrid provider scope: a curated global catalog (admin-managed)
  plus household-private providers.** Pure catalog would strand a household
  whose provider is not listed until an admin adds it; pure private produces
  duplicate near-names. Hybrid keeps the catalog useful but never blocking,
  and `promote` + account re-pointing give a cheap path from "household
  made its own" to "everyone uses the shared one". *(Revises v0.1, which was
  household-only.)*
- **D2 — The rule lives on the account, not the provider; the catalog's
  `defaultRule` is a copied template.** One provider, several utilities,
  several windows — and an admin edit must never silently move a
  household's deadline. (If every provider has exactly one window in
  practice, the rule could move up a level at the cost of a migration.)
- **D3 — Provider Service owns window computation and exposes it.** The
  alternative — events carry the rule and Reminders re-implements §7 — means
  two calendar implementations that will drift. Phase 4's spec may drop the
  internal endpoint if it prefers to consume only events plus the public
  window API.
- **D4 — NestJS/Prisma rather than Spring.** Reuse of the outbox/Kafka code
  versus consistency with household/identity (jOOQ). Reading Service is the
  closest sibling (events + Prisma), so it wins.
- **D5 — Meter validation via a call to Meter Service on the caller's
  behalf**, not a local copy of meter data, so no cross-service data
  duplication and no meter events needed yet. If that call becomes a hot
  path, a `meter.created` consumer is the natural upgrade (roadmap 2:
  `MeterCreated` events were already anticipated).
- **D6 — A meter binds to one account at a time.** A meter has one supplier
  at a time; many meters per account is supported.
- **D7 — Admins are declared by user ID in deployment config, reconciled at
  identity startup; no grant API yet.** Smallest thing that works with one
  or two admins, and safe given unverified registration (§5.3). Revisit with
  a grant endpoint (itself ADMIN-only, audited) if admin turnover appears.
- **D8 — The role travels in the access token (`roles` claim), not a live
  lookup.** Zero new runtime dependency for Provider Service; cost is
  ≤ one TTL of demotion lag, with `jti` revocation for emergencies.
- **D9 — Single `ADMIN` role, catalog-only.** No cross-household data access
  for admins, so compromising or misusing the role cannot expose household
  data; a broader support role would be its own spec.
