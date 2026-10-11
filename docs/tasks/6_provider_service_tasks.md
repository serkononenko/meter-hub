# Provider Service (Core) & System Roles — Task Breakdown

Spec: [../spec/6_provider_service_spec.md](../spec/6_provider_service_spec.md) (roadmap Phase 3).
Workflow mirrors the earlier breakdowns (M, T, L, R, K): tick a box only after live
verification, record detours honestly. Decisions D1–D9 are drafted in spec §13 — **confirm
them before starting P1**; S1–S3 do not depend on D1–D6 and can start immediately.

Two epic groups, shippable independently and in this order:

- **S — System roles** (identity-service, plus the frontend reading the claim). Ships
  alone: nothing consumes `ADMIN` until P3, and nothing breaks if S lands first.
- **P — Provider Service.** Needs S for the global-catalog write path only; P1–P2 can
  overlap with S.

Service reality this builds on (verified 2026-10-11):

- `users` has `status` but no role column (`V20260905115213__create_table.sql`); access
  tokens carry only `iss`/`sub`/`aud`/`iat`/`exp`/`jti` (`JwtAccessTokenIssuer.issue(UUID subject)`).
- `AuthService.refresh` reloads the user from the database before reissuing, so a role
  change reaches the next token without extra work.
- NestJS auth guards (meter, reading) set `request[REQUEST_USER] = {userId: subject}` and
  read nothing else from the token.
- Identity has no email verification, so identity-by-email is not a safe admin key (spec §5.3).
- Reading Service already calls Meter Service with the caller's bearer token forwarded
  (`meter-api.provider.ts`) and Household Service's internal verdict through a 30 s
  `VerdictCache` — Provider Service copies both patterns.
- Port 8086 is free; the DB-per-service init script is `infrastructure/postgres/init/01-create-databases.sh`.

## Epic S1 — Identity: role model & token claim

S1.1 Contract (`contracts/openapi/services/identity-service/openapi.yaml`)
- [x] `User` schema gains `roles` (array of `USER` | `ADMIN`, always present); examples updated; `SystemRole` schema added; contract bumped to 1.1.0. (Detour: `uniqueItems: true` was dropped — the Java generator turns it into a `Set` plus a Jackson 2 `@JsonDeserialize` import this service's Jackson 3 build doesn't have. Uniqueness is guaranteed server-side by `User.systemRoles()` (an `EnumSet`), emitted in enum order, and noted in the schema description.)
- [x] Document the `roles` access-token claim next to the existing token description (on the `bearerAuth` security scheme).
- [x] Redocly lint: the same 4 errors / 2 warnings as before the change (pre-existing: `security-defined`, `no-empty-servers`, `info-license`, `operation-4xx-response`), none introduced; Orval client regenerated for identity only (`systemRole.ts` added, `user.ts` gains `roles`), `tsc --noEmit` clean. Gateway and identity both build from this contract; gateway tests green (nothing there deserializes `User`). Note: regenerating also rewrites the committed meter/reading clients because their 1.1.0 contracts are newer than the committed output — that drift predates this work, so those files were left out of S1 and stay stale.

S1.2 Migration & domain (`db/migration/users/`)
- [x] New Flyway migration (`V20261011120000__add_user_role.sql`, sorts after the existing users migrations): `users.role VARCHAR(20) NOT NULL DEFAULT 'USER'` +
      `CHECK (role IN ('USER','ADMIN'))`; existing rows become `USER`. (jOOQ DDLDatabase
      note from R1.2/D1: keep anything H2 can't parse inside `/*[ignore]*/`.)
- [x] `SystemRole` domain enum, named and documented apart from household `MembershipRole`;
      `User` carries it; repository maps it.

S1.3 Token issuance
- [x] `AccessTokenIssuer.issue` takes the user's roles (not just the subject); the issuer
      writes the `roles` claim (`["USER"]` / `["USER","ADMIN"]`). Both `issueTokens` paths
      (login, refresh) pass the freshly loaded user's roles.
- [x] `GET /api/v1/users/me` returns `roles` (and the login/refresh/register bodies carry `user.roles`).
- [x] Tests: `UserTest` (role expansion), `AuthServiceTest` (login issues the user's roles, refresh reloads the user so a role change reaches the next token, not-ACTIVE refresh still rejected), `RefreshIntegrationTest` (decoded `roles` claim, USER → promoted → next refresh carries `[USER, ADMIN]`), `CurrentUserIntegrationTest` (`roles` on `/users/me`). Identity suite green. **Live (2026-10-11, through the gateway on Compose):** new user → token claim and `/users/me` both `[USER]`; promoted in the DB → refresh token carries `[USER, ADMIN]`, the pre-promotion token is unchanged until it expires.

## Epic S2 — Identity: deployment-configured admins

- [x] `IDENTITY_ADMIN_USER_IDS` (comma-separated UUIDs, empty = no admins) bound in
      identity's configuration (`AdminProperties`, `identity.admin.user-ids`); malformed entries fail startup loudly rather than being
      skipped (a typo must not silently mean "no admin"). (Live: `<uuid>,not-a-uuid` → `APPLICATION FAILED TO START … Failed to bind properties under 'identity.admin.user-ids'`.)
- [x] Startup reconciliation (`AdminReconciliationService`, run by an `ApplicationRunner` after migrations) in one transaction: listed users → `ADMIN`, any other
      `ADMIN` → `USER`; each change logged with the user ID; an ID with no matching user is
      logged and ignored.
- [x] Tests (`AdminReconciliationIntegrationTest`, 9 cases, real Postgres; full identity suite 71/71): promote, demote, unknown
      ID ignored, idempotent re-run, malformed value fails startup; registering with a
      would-be admin's email confers nothing.
- [x] Env plumbing: `.env.example`, `stack.env.example`, `docker-compose.yml`,
      `docker-compose.portainer.yml`; `docs/deploy-portainer.md` explains the procedure
      (register → read ID from `/users/me` → add to env → restart identity).
- Live (2026-10-11, Compose, through the gateway): registered user → rebuilt identity with their ID listed → log shows `Promoted user …`, login returns `[USER, ADMIN]`; restarted with the list empty → `Demoted user …`, next refresh returns `[USER]`; malformed value → service refuses to start with the binding error. Demotion, like promotion, reaches the user at their next refresh — an already-issued token keeps `ADMIN` until it expires.
- Detour: one refresh call right after a demotion restart returned a body without `user` in my first script run; two clean reruns of the identical scenario returned 200 with the right roles. Not reproduced and not explained — most likely a request racing the freshly recreated container, but that is a guess, not a finding.

## Epic S3 — Frontend: read the role

- [x] Auth/user model exposes `roles` from `/users/me` (the auth context already uses the generated `User`; the hand-written `SessionUser` shapes gained `roles`, and `session.ts` now re-exports the one in `session-user.ts` instead of keeping a duplicate); helper `isAdmin()` in `src/lib/auth/roles.ts`.
- [x] No UI yet beyond the helper (the catalog admin screen is P7) — keeps S shippable alone. **Not done as written: no committed unit test** — the frontend has no test runner (no vitest/jest in `package.json`), and adding one is a project decision, not part of this task. `isAdmin` was checked with a throwaway script instead (ADMIN → true, USER-only / null / undefined → false). Add the test when a runner lands.
- [x] `tsc --noEmit`, eslint, `next build` clean.

## Epic S4 — S verification & docs

- [x] Live through the gateway (2026-10-11, Compose): admin ID in env → login → decoded token shows `["USER","ADMIN"]`; an unlisted user shows `["USER"]`; env cleared + identity restart → next refresh drops `ADMIN`. Test users removed, identity restored to an empty admin list.
- [x] `docs/service-boundaries.md` §2 (Identity) gains system roles, the claim, and the
      "household roles stay in Household Service" line.
- [x] `docs/api-examples.md`: `roles` on the register, login and `/users/me` examples, the token claim, and a pointer to the admin procedure. (The register/login examples also lacked `createdAt`; left as they were.)

## Epic P1 — Contract, events & scaffolding (provider-service)

P1.1 OpenAPI (`contracts/openapi/services/provider-service/openapi.yaml`)
- [x] Paths per spec §6: `/providers` (+ `/{providerId}`, `/{providerId}/promote`),
      `/provider-accounts`, `/meter-bindings`, `/submission-windows`, and the internal
      `/internal/submission-windows` (Internal tag, `security: []`, gateway-`denyAll`
      note) — included only if D3 stands.
- [x] Schemas: `Provider` (with `scope`), `ProviderAccount`, `MeterBinding`,
      `SubmissionRule` / `DaySpec`, `SubmissionWindow`.
- [x] Problems and examples for every code in spec §10, including
      `FORBIDDEN_SYSTEM_ROLE`.
- [x] Redocly lint: only `no-empty-servers` and `info-license`, the same two the meter and reading contracts report. NestJS server stubs and the household client generated into `provider-service`. The Orval frontend client is **not** generated yet — it lands with P7 (frontend), when something uses it; `orval.config.ts` also needs the new service in its prefix map and the gateway route from P6.

P1.2 Event contracts
- [x] `contracts/events/provider/account-changed.v1.schema.json` and
      `binding-changed.v1.schema.json` (spec §8 payloads, spec 5 envelope); types generated
      via `contracts/events/generate.sh`. (The schemas are committed; the TypeScript types are not generated into `provider-service` yet — P5 needs them for the outbox, and `generate.sh` now takes a domain argument for it. Re-running it for reading-service produced no diff.)

P1.3 Scaffolding
- [x] New NestJS service `services/provider-service` from the reading-service shape:
      config, Prisma, health/liveness probe, `/metrics`, structured logging, correlation
      middleware, tracing, `.npmrc` (`legacy-peer-deps=true`, COPYed into Docker — see the
      npm/Prisma memory note), Dockerfile.
- [x] `provider_db` / `provider_user` in the Postgres init script; env vars in
      `.env.example`, `stack.env.example`.
- [x] Verify clean-lockfile install and that a DI failure is not a silent exit. (Lockfile regenerated from a wiped `node_modules`; `npm ci` dry-run clean. A Docker build from only the git-tracked files succeeds, so nothing outside the repo is needed. The container reaches `healthy`, `/health/ready` reports the database up, `/metrics` serves. No DI failure occurred.)
- Landed alongside: Compose and Portainer entries (port 8086, liveness healthcheck, `depends_on` postgres + household), `docs/ports.md` row, README counts (six databases / six services / seven images), the CI NestJS test matrix, the e2e readiness check and `.env` password override, and the publish matrix. Gateway routes and Grafana/Prometheus wiring are P6.
- Detours: the Postgres init script only runs on a fresh volume, so `provider_db` was created by hand in the running dev instance (same SQL as the script); a clean volume or Portainer redeploy needs `docker compose down -v` or the same manual step. Only the pieces P1 needs were copied from reading-service — no idempotency, scheduler, TypedSQL, outbox or meter client yet; each arrives with the task that uses it. The scaffold's generated Prisma client has no models yet (bootstrap migration is `SELECT 1`), exactly as reading-service started.
- Verified: `nest build`, `oxlint` (no findings outside generated code), 15/15 unit tests.

## Epic P2 — Window calculation (pure domain)

- [x] `windowFor(rule, cycleMonth)` and the rule validator (`validateSubmissionRule`), implemented as pure functions
      (no Nest, no DB) per spec §7, under `src/submission-window/`. Time zones use `Intl` only — no new dependency.
- [x] Table tests (`submission-window.spec.ts`, `submission-rule.validator.spec.ts`; 49 cases): 30/31-day months, leap and non-leap February, `DAY_OF_MONTH` 29–31
      clamping, `LAST_DAY` with offsets, equal-day single-day window, wrapping window
      (open 25th, close 5th), closing-day-exclusive upper bound, DST zones on both
      transition dates, windows longer than the cycle rejected, unknown timezone rejected.
- [x] `currentAndNext(rule, at)` helper used by the API and (later) Reminders; tested at
      window boundaries (instant of `opensAt`, instant before/at `closesAt`).
- Verified: 64/64 unit tests in the service, `tsc` and lint clean. The DST expectations (Kyiv spring/autumn, São Paulo's skipped midnight, Havana's repeated midnight) were cross-checked against the system `date` and Python `zoneinfo`, not just against the implementation. Three deliberate mutations — closing day exclusive, no day clamping, ignoring the time zone — each failed the suite.
- Decisions the spec left open: (1) a day whose midnight is skipped starts at the instant the clocks jump; one whose midnight happens twice starts at the first occurrence. (2) The "window longer than the cycle" check became "consecutive windows must leave a gap": the validator computes every window across 24 months (a leap and a non-leap year) and rejects a rule where one window ends at or after the next opens. This is stricter than the spec's wording and also catches a clamping case the spec's example misses — opens 31st / closes 30th overlaps only in short months. A window closing the instant the next opens (e.g. opens the 1st, closes the last day) is therefore also rejected, since it would be open permanently.
- Zone names: validation accepts what the runtime accepts, so a legacy alias like `Europe/Kiev` and any casing passes, while offsets (`+03:00`) are rejected. `Intl.supportedValuesOf` lists `Europe/Kiev` but not `Europe/Kyiv`, yet `Intl` itself accepts `Europe/Kyiv`; the validator relies on construction, not that list.

## Epic P3 — Providers (catalog & private)

- [x] Prisma schema + migration (two migrations: tables/indexes, then the partial unique index — Prisma's schema language can't express a partial index, and `migrate diff` against the live DB confirms no drift): `providers`, `provider_accounts`, `meter_bindings`
      (spec §4) with actor columns, `version`, `archived_at`; partial unique index
      `meter_id WHERE valid_to IS NULL`.
- [x] Auth guard extends the request user to `{userId, roles}`; household access service +
      `VerdictCache` + internal household client ported from reading-service.
- [x] Provider CRUD with scope rules: `GLOBAL` ⇒ `ADMIN` (`403 FORBIDDEN_SYSTEM_ROLE`),
      `HOUSEHOLD` ⇒ MEMBER+ (`403 FORBIDDEN_ROLE`); list returns catalog + own private;
      other households' private providers are `404`; archive instead of delete.
- [x] `promote` (ADMIN, `409 PROVIDER_ALREADY_GLOBAL`); admin writes structured-logged
      with the admin's subject.
- [x] `defaultRule` validated with the P2 validator on save.
- [x] Tests (`test/providers.e2e-spec.ts`, 23 cases, real Postgres + a household-service stand-in): system-role × household-role authorization matrix (ADMIN who is not a member
      gets `404` on household data), visibility rules, promote.
- Verified: 23/23 e2e and 67/67 unit tests, `tsc`, lint, `nest build`. Four deliberate mutations — admin check disabled, household write check weakened to read, other households' private providers leaking into the pick list, a foreign private provider readable by id — each failed the suite.
- Account/binding/window endpoints are present as stubs answering `501 NOT_IMPLEMENTED` so the generated module wires up; P4 and P5 replace them.
- Deviations from the plan, found by the tests: (1) the generated controllers return 201 for every POST, so `promote` (documented 200) is fixed with an `HttpCode` override applied from the module — the controllers are regenerated by `api:gen`, so it can't live in their source. (2) The generated controllers only default a missing boolean query parameter; a real `?includeArchived=true` arrives as the string `"true"`, so it is parsed explicitly. (3) A `householdId` on a GLOBAL provider returned 500 instead of 400 because the validation skipped it when present-but-forbidden; the rule now lives in one constraint.
- Not an authorization hole but worth knowing: an ADMIN gets the same 404 as anyone else for a household they don't belong to, on every provider route — verified for create, read and the pick list.
- Pre-existing red CI, fixed separately (`ffeee79`): the `nestjs-tests` job had no Postgres, so reading-service's idempotency-store spec has failed on `main` since it landed. It now has a Postgres service, the reading/provider databases and `prisma migrate deploy`. I reproduced the failure mode locally (empty database → `relation "idempotency_keys" does not exist`; migrated → 19/19). Not run on GitHub Actions itself yet.
- Time-zone validation was probed explicitly: `Europe/Kyiv` and `UTC` are accepted unchanged; offsets (`+03:00`, `-05:00`), `Z`, `UTC+3`, unknown names and `""` are rejected. Case variants (`europe/kyiv`) and legacy aliases (`Europe/Kiev`, `EST`) are accepted *as given* — the same in the Node 25 Docker image as locally. They compute correctly, so it is harmless, but the stored value is not canonicalised; revisit if anything ever compares zone names as strings.

## Epic P4 — Accounts & bindings

- [x] Accounts: create (rule copied from `defaultRule` when omitted, else
      `422 INVALID_SUBMISSION_RULE`), list, get, patch (label, rule, archive, re-point
      `providerId` to a visible provider — `422 HOUSEHOLD_MISMATCH` otherwise), `version`
      bumped on rule/provider change.
- [x] `ACCOUNT_HAS_ACTIVE_BINDINGS` on archive; archived providers cannot be chosen for new
      accounts but keep serving existing ones.
- [x] Bindings: create with Meter Service validation through the forwarded bearer token
      (`422 METER_NOT_FOUND`, `503` fail-closed when unreachable), household match check,
      end via `validTo`, history queries.
- [x] Overlap protection: partial unique index for open-ended bindings **and** a
      transactional overlap check against closed ones (`409 METER_ALREADY_BOUND`).
- [x] Concurrency test against real Postgres (16 parallel binds of one meter → exactly one
      winner), like the idempotency-store race test.
- Verified: 64/64 e2e (23 providers + 21 accounts + 20 bindings) and 67/67 unit tests, `tsc`, lint, build. **Live through Compose:** with a real household and meter, provider-service created a provider and account, bound the real meter (its call to meter-service with the forwarded token succeeded), answered 409 on a second bind and 422 for an unknown meter; test data removed afterwards.
- Race: 16 concurrent binds of one meter across four accounts give exactly one 201, fifteen `METER_ALREADY_BOUND` 409s and one open row. Checked three ways: with the advisory lock; with the lock removed; and with the lock *and* the application-level overlap check removed, leaving only the partial unique index (the unique violation is mapped to the same 409, 5 runs each). Without that mapping the index alone produced 500s in an earlier run — the mapping is what makes the index a usable backstop.
- Five deliberate mutations each failed the suite: advisory lock removed, viewer allowed to bind, household mismatch unchecked, a foreign account readable by id, and the lock-and-precheck removal above.
- Spec/contract changes made while building (please review — they are decisions, not generated noise):
  - **`version` semantics pinned.** Account `version` bumps on any actual change (label, number, rule, provider, archiving) and *not* on a no-op request — a rule re-sent in a different key order compares equal. Binding `version` is 1 on create and 2 once ended. The contract text now says so; the old "rule or provider" wording would have left label changes invisible to a consumer using `version` to discard stale snapshots.
  - **Supplier switch is `validTo` D-1 / new `validFrom` D.** `validTo` is the last day a binding applies, so ending on D and starting on D overlap; the contract now says so (the spec's "same day if needed" was ambiguous about this). Ending on the binding's own start day is allowed.
  - New problem codes, all documented in the contract: `ACCOUNT_ARCHIVED`, `PROVIDER_ARCHIVED`, `BINDING_ALREADY_ENDED` (409), `INVALID_BINDING_PERIOD` (422), `METER_SERVICE_UNAVAILABLE` (503). `HOUSEHOLD_MISMATCH` now means the meter's household differs from the account's; a provider not visible to the household is `404 PROVIDER_NOT_FOUND` (so another household's private providers can't be probed).
  - Archiving checks bindings *in effect today in the account's time zone*, not merely "open": a binding that ended yesterday no longer blocks it.
  - Re-pointing an account to a different provider requires that provider to be visible and not archived; bindings are untouched.
- Bugs found by the tests/live run and fixed: `meter.url` was never in the service config and the Compose files never passed `METER_SERVICE_URL` (provider-service also now waits for meter-service); `pg_advisory_xact_lock` returns `void`, which Prisma's raw query cannot deserialise; malformed path/query identifiers returned 500 or the wrong code (now `400 VALIDATION_ERROR`, including `scope`); the e2e files share tables, so they now run serially (`fileParallelism: false`) — in parallel they corrupted each other.
- Gateway routes for provider-service do not exist yet, so the public path through the gateway returns 404 (P6). The live check above therefore called the service directly with a real gateway-issued token.
- Not done here, by design: events (P5). The `version` numbers above are what the P5 snapshots will carry.

## Epic P5 — Submission-window API & events

- [x] `GET /submission-windows?meterId=&at=`: binding in force + `{current?, next}`;
      meter without a binding → `200` empty body.
- [x] Internal `GET /internal/submission-windows?accountId=&from=&to=` (D3 stands).
- [x] Outbox table + relay + Kafka producer ported from reading-service; account and
      binding changes write snapshot rows in the same transaction as the change; `version`
      carried; topics `provider.account.changed` / `provider.binding.changed`.
- [x] Tests: event per mutation, none for rejected mutations, no outbox row on failed
      transaction, out-of-order `version` detectable; relay survives broker downtime.
- Verified: 88/88 e2e (adds 14 window + 9 outbox cases) and 81/81 unit tests (adds the relay, ported from reading-service, and the event builders), `tsc`, lint, build — and **30 consecutive full e2e runs with no failure**. Live on Compose: a real household and meter, account created, relabelled twice (the second a no-op), binding created and ended → four outbox rows (`account.changed` v1, v2; `binding.changed` v1, v2), all published to the real broker, and all four consumed from Kafka validate against the committed JSON Schemas with ajv.
- Mutations that each failed the suite: account update writes no event; a no-op update still writes one; ending a binding writes no event; the binding event written before the overlap check (so a lost race would leave an event behind); the account UPDATE committed outside the transaction that writes its event. A dedicated test makes the outbox write throw and asserts the account row and version are rolled back.
- Events carry ids, versions and the window rule — not the account's label or account number (asserted).
- Topics: nothing creates them explicitly. The broker's default auto-creation made `provider.account.changed` / `provider.binding.changed` on first publish, the same way reading-service's topic exists; there is no topic-provisioning step to forget in Portainer.
- Behaviour decisions worth reviewing:
  - **`GET /submission-windows` on a meter the caller cannot see is `404 METER_NOT_FOUND`**, not 422: a read of a meter is not a bad reference in a request body. Binding to such a meter keeps `422 METER_NOT_FOUND` (it *is* a bad reference there). The contract documents both.
  - **The binding in force is found in the account's own time zone** (a binding starting 1 March is in force from 22:00 UTC on 28 Feb for a Kyiv account), the same day boundary the windows use.
  - **Internal endpoint is unauthenticated** (marked public from the module, since the generated controller can't carry the decorator) until A1 service-to-service auth lands, like the other services' internal surfaces. The gateway `denyAll` for `/api/v1/internal/**` is P6.
  - **Kafka producer connects on first publish**, not at startup, so the service boots and serves HTTP while the broker is down and events queue in the table; verified (a failing publish leaves the row unpublished and requests still work).
  - New switch `OUTBOX_RELAY_ENABLED` (default on). The specs turn it off and drive rounds explicitly: with the 500 ms timer racing them, three different assertions flaked at roughly 1 run in 10, and each was a genuine race in the *test*, not in the relay.
- Dev-environment gotcha found the hard way: the e2e specs and the Compose `provider-service` container share `provider_db`. While the container runs, its relay publishes the specs' rows to the dev broker — about 350 junk events landed on the two provider topics before I noticed. With the container stopped a full e2e run adds none (checked: 352 → 352). They are harmless on a dev broker (nothing consumes these topics yet) and were left in place; `docker compose down -v` clears them, and CI is unaffected (its own Postgres, no broker). Worth a dedicated test database if this bites again.
- Not done here: Prometheus/Grafana for the outbox metrics (`provider_outbox_*`) and the gateway routes are P6; the consumer side is Phase 4. The Orval frontend client is still P7.

## Epic P6 — Gateway, Compose & observability

> Landed 2026-10-11, verified against the running Compose stack.

- [x] Gateway route `provider` (`/api/provider-service/**`, StripPrefix=2,
      `PROVIDER_SERVICE_URL` in both compose files, gateway `depends_on` provider-service
      `service_healthy`); `denyAll` on `/api/provider-service/api/v1/internal/**` placed
      before `anyRequest().authenticated()`. Live through the gateway: anonymous → 401,
      user token → 200, internal path with user token → 403. New gateway test
      `internalPathsOfEveryServiceAreNeverProxied` covers every service's internal paths
      (401 anonymous / 403 authenticated, no downstream stub hits); mutation check —
      removing the provider deny matcher fails the test.
- [x] Compose + Portainer entries: port 8086, liveness healthcheck, `depends_on`
      postgres/household/kafka/meter `service_healthy`, env wiring
      (`HOUSEHOLD_SERVICE_URL`, `METER_SERVICE_URL`, `KAFKA_BROKERS`, OTEL env);
      `docs/ports.md` row landed back in P2.
- [x] Prometheus job `provider-service` — target `provider-service:8086/metrics` is up
      (`up == 1`); all four `provider_outbox_*` series present. Grafana overview
      dashboard regex/titles/thresholds extended to provider; async-backbone gained
      the "Outbox relay (provider-service)" row (unpublished stat, publish rate, error
      rates). Loki/Promtail pick logs up by container like the other services; the
      Jaeger leg is env-only (`OTEL_SERVICE_NAME` + OTLP endpoint) and appears when
      the tracing stack runs.
- [x] CI: `nestjs-tests` matrix includes provider-service with its own Postgres
      databases + `prisma migrate deploy` + e2e step (landed in ffeee79 + P3–P5);
      publish workflow builds the `meter-hub-provider-service` image. Not yet observed
      green on GitHub Actions — verified with the next push.

Detour: the dev volume's Grafana admin password differs from the compose default, so
dashboard verification went through provisioning logs + the mounted dashboard files
instead of the HTTP API (provisioning finished clean, `provider_outbox` present in the
mounted async-backbone JSON).

## Epic P7 — Frontend

> Landed 2026-10-11 (commits 952bfbe, 9d78cee, 5441ab7), flows verified live
> through the gateway with Playwright against the Compose stack.

- [x] Provider client regenerated from the P1 contract (orval prefix-map entry
      `provider-service`); regeneration also caught the meter/reading clients up to
      their contracts' A3 wording and 403 responses.
- [x] Provider picker (catalog first, private marked, "Add my own provider…" creates
      a private provider inline); account list shows the rule in plain words
      ("Readings due: opens on day 20 of the month, closes on the last day of the
      month"); account editor with shared zod rule form pre-filled from
      `defaultRule`, provider re-pointing, archive/restore with confirm step.
- [x] Meter cards show the current-or-next submission window as a register-styled
      strip (Spline Sans Mono date range + open/upcoming chip + days countdown),
      "No provider linked" empty state, link/unlink actions — bind with valid-from,
      end with last-day (dialog keyed by binding so bind/end modes don't leak).
- [x] Catalog admin screen at `/catalog`: nav item + `AdminGate` gated on
      `isAdmin()` (S3); list/create/edit default window/archive for global
      providers with live plain-language preview; private-providers-in-use list
      with promote. Required a backend gap fix (9d78cee): the providers list
      without `householdId` returned only GLOBAL rows, so admins had no way to
      discover private providers — admins now get private rows too, e2e-covered.
- [x] VIEWERs get read-only panels (same `canWrite` pattern as meters); provider
      problem codes (`ACCOUNT_ARCHIVED`, `INVALID_SUBMISSION_RULE`,
      `FORBIDDEN_SYSTEM_ROLE`, …) mapped to plain-language messages.
- [x] `tsc --noEmit`, eslint, `next build` all clean. Live Playwright journeys
      against Compose: non-admin sees "Administrators only" and no nav item; admin
      creates a catalog provider (rule preview updates live); member picks it,
      default rule prefills, account created; meter link → window chip appears
      ("Opens in 9 d" on the 11th for a day-20 rule); end link → binding `validTo`
      set (still "active today" per inclusive closing, backend-verified);
      "Add my own" creates a private provider inline; promote moves it to GLOBAL.
      Not covered: a dedicated VIEWER click-through (the `canWrite` flag pattern is
      shared with meters, which are covered), and the rule form's overlap error
      path is only observed via API message, not scripted.

Detours: the default rule form (opens 1st, closes last day) turned out to be an
*invalid* rule — consecutive full-month windows leave no gap, which the backend
rejects; the form default is now opens 1st / closes 20th. The e2e suite shares
`provider_db` with the live Compose stack and wipes its data (the known P5
gotcha) — dev data was recreated through the API afterwards.

## Epic P8 — End-to-end verification & docs

- [ ] `e2e/providers.e2e.test.mjs` through the gateway: admin (via env-declared ID) creates
      a catalog provider with a default window → household member creates an account →
      binds a meter → windows API answers → viewer can read, not write → non-admin gets
      `FORBIDDEN_SYSTEM_ROLE` on the catalog → admin without membership gets `404` on the
      household's accounts → supplier switch (end + rebind) keeps both rows → overlapping
      bind rejected → `provider.account.changed` / `binding.changed` observed on Kafka.
      Original journey and roles tests stay green (`node --test e2e/`).
- [ ] `docs/service-boundaries.md` §7: Provider Service from "Future" to the real boundary
      (owned data, events, "Meter Service never learns provider specifics").
- [ ] `docs/api-examples.md` and README e2e section updated.
- [ ] Roadmap Phase 3 marked done with a dated note; backlog gains an entry only if a real
      limitation surfaced (e.g. unverified-registration admin bootstrap, admin demotion lag).
