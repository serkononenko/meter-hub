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
- [ ] Paths per spec §6: `/providers` (+ `/{providerId}`, `/{providerId}/promote`),
      `/provider-accounts`, `/meter-bindings`, `/submission-windows`, and the internal
      `/internal/submission-windows` (Internal tag, `security: []`, gateway-`denyAll`
      note) — included only if D3 stands.
- [ ] Schemas: `Provider` (with `scope`), `ProviderAccount`, `MeterBinding`,
      `SubmissionRule` / `DaySpec`, `SubmissionWindow`.
- [ ] Problems and examples for every code in spec §10, including
      `FORBIDDEN_SYSTEM_ROLE`.
- [ ] Redocly lint clean; generate the NestJS server stubs and the Orval frontend client.

P1.2 Event contracts
- [ ] `contracts/events/provider/account-changed.v1.schema.json` and
      `binding-changed.v1.schema.json` (spec §8 payloads, spec 5 envelope); types generated
      via `contracts/events/generate.sh`.

P1.3 Scaffolding
- [ ] New NestJS service `services/provider-service` from the reading-service shape:
      config, Prisma, health/liveness probe, `/metrics`, structured logging, correlation
      middleware, tracing, `.npmrc` (`legacy-peer-deps=true`, COPYed into Docker — see the
      npm/Prisma memory note), Dockerfile.
- [ ] `provider_db` / `provider_user` in the Postgres init script; env vars in
      `.env.example`, `stack.env.example`.
- [ ] Verify clean-lockfile install and that a DI failure is not a silent exit.

## Epic P2 — Window calculation (pure domain)

- [ ] `windowFor(rule, cycleMonth)` and the rule validator, implemented as pure functions
      (no Nest, no DB) per spec §7.
- [ ] Table tests: 30/31-day months, leap and non-leap February, `DAY_OF_MONTH` 29–31
      clamping, `LAST_DAY` with offsets, equal-day single-day window, wrapping window
      (open 25th, close 5th), closing-day-exclusive upper bound, DST zones on both
      transition dates, windows longer than the cycle rejected, unknown timezone rejected.
- [ ] `currentAndNext(rule, at)` helper used by the API and (later) Reminders; tested at
      window boundaries (instant of `opensAt`, instant before/at `closesAt`).

## Epic P3 — Providers (catalog & private)

- [ ] Prisma schema + migration: `providers`, `provider_accounts`, `meter_bindings`
      (spec §4) with actor columns, `version`, `archived_at`; partial unique index
      `meter_id WHERE valid_to IS NULL`.
- [ ] Auth guard extends the request user to `{userId, roles}`; household access service +
      `VerdictCache` + internal household client ported from reading-service.
- [ ] Provider CRUD with scope rules: `GLOBAL` ⇒ `ADMIN` (`403 FORBIDDEN_SYSTEM_ROLE`),
      `HOUSEHOLD` ⇒ MEMBER+ (`403 FORBIDDEN_ROLE`); list returns catalog + own private;
      other households' private providers are `404`; archive instead of delete.
- [ ] `promote` (ADMIN, `409 PROVIDER_ALREADY_GLOBAL`); admin writes structured-logged
      with the admin's subject.
- [ ] `defaultRule` validated with the P2 validator on save.
- [ ] Tests: system-role × household-role authorization matrix (ADMIN who is not a member
      gets `404` on household data), visibility rules, promote.

## Epic P4 — Accounts & bindings

- [ ] Accounts: create (rule copied from `defaultRule` when omitted, else
      `422 INVALID_SUBMISSION_RULE`), list, get, patch (label, rule, archive, re-point
      `providerId` to a visible provider — `422 HOUSEHOLD_MISMATCH` otherwise), `version`
      bumped on rule/provider change.
- [ ] `ACCOUNT_HAS_ACTIVE_BINDINGS` on archive; archived providers cannot be chosen for new
      accounts but keep serving existing ones.
- [ ] Bindings: create with Meter Service validation through the forwarded bearer token
      (`422 METER_NOT_FOUND`, `503` fail-closed when unreachable), household match check,
      end via `validTo`, history queries.
- [ ] Overlap protection: partial unique index for open-ended bindings **and** a
      transactional overlap check against closed ones (`409 METER_ALREADY_BOUND`).
- [ ] Concurrency test against real Postgres (16 parallel binds of one meter → exactly one
      winner), like the idempotency-store race test.

## Epic P5 — Submission-window API & events

- [ ] `GET /submission-windows?meterId=&at=`: binding in force + `{current?, next}`;
      meter without a binding → `200` empty body.
- [ ] Internal `GET /internal/submission-windows?accountId=&from=&to=` (if D3 stands).
- [ ] Outbox table + relay + Kafka producer ported from reading-service; account and
      binding changes write snapshot rows in the same transaction as the change; `version`
      carried; topics `provider.account.changed` / `provider.binding.changed`.
- [ ] Tests: event per mutation, none for rejected mutations, no outbox row on failed
      transaction, out-of-order `version` detectable; relay survives broker downtime.

## Epic P6 — Gateway, Compose & observability

- [ ] Gateway routes for the four public prefixes; `/api/v1/internal/**` stays `denyAll`
      with a test for the new internal path; confirm no route collision with
      `/api/v1/meters/**`.
- [ ] Compose + Portainer entries: port 8086, liveness healthcheck, `depends_on` postgres
      and kafka `service_healthy`, env wiring (`HOUSEHOLD_SERVICE_URL`, `METER_SERVICE_URL`,
      Kafka brokers); `docs/ports.md` row.
- [ ] Prometheus scrape target, Grafana overview rows (requests, outbox lag), Loki/Promtail
      pick-up, Jaeger service appears with the async leg linked.
- [ ] CI: tests + e2e wiring, image published to ghcr.io like the other services.

## Epic P7 — Frontend

- [ ] Regenerate the provider client from the P1 contract.
- [ ] Provider picker (catalog, then own private, "Add my own"); account list with the
      window in plain language; account editor with zod rule form pre-filled from
      `defaultRule`; re-point provider action.
- [ ] Meter view: current provider/account and current-or-next window, "No provider linked"
      state, bind/unbind with end date.
- [ ] Catalog admin screen, route gated on `isAdmin()` (S3): list/create/edit default
      window/archive, private-providers-in-use list with promote.
- [ ] VIEWER hides writes; new problem codes mapped to messages.
- [ ] `tsc --noEmit`, eslint, `next build` clean; Playwright journeys against Compose
      (admin curates, member binds a meter, viewer read-only, non-admin cannot reach the
      admin screen).

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
