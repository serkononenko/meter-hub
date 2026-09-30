# Household Membership Roles — Task Breakdown

Spec: [../spec/4_membership_roles_spec.md](../spec/4_membership_roles_spec.md) (backlog A3, depends on A4's internal-feed pattern).
Workflow mirrors the metrics (M1–M3) and log-aggregation (L1–L3) breakdowns: tick a box only after live verification, record detours honestly. Open questions from the spec are resolved there (§11): inline redeem dialog, owner-only invites, per-request access-verdict call.

Service reality this builds on (verified 2026-09-27):

- household-service currently has a single-row-per-household `household_members` table (`UNIQUE household_id`, role `OWNER` only) and only `POST/GET /households` APIs.
- meter-service checks household *existence* only (`HouseholdService.getHousehold` → 404 masking); reading-service checks meter *access* the same way (`MeterService`). Neither knows about roles.
- A4 landed the pattern this PRD reuses: internal endpoint on `permitAll` internal surface, gateway `denyAll` on proxied `/api/v1/internal/**`, compact poll/cached response.

## Epic R1 — Contract & data model (household-service)

R1.1 OpenAPI contract update (`contracts/openapi/services/household-service/openapi.yaml`)
- [x] New public paths: `POST/GET /api/v1/households/{householdId}/invites`, `DELETE .../invites/{inviteId}`, `POST /api/v1/households/invites/redeem`, `GET .../members`, `DELETE .../members/{userId}`.
- [x] `Household` schema gains caller's `role` (OWNER/MEMBER/VIEWER) on list + get responses.
- [x] New internal path `GET /api/v1/internal/household-access?householdId=&userId=` returning `{role, exists}` — mirror A4's `Internal` tag, `security: []`, compact-body rationale comment, "not reachable through gateway" note.
- [x] Error semantics: `HOUSEHOLD_ACCESS_DENIED` (403), `FORBIDDEN_ROLE` (403), `INVITE_NOT_FOUND` (404), `INVITE_EXPIRED` (410), `INVITE_ALREADY_USED` (409), `OWNER_CANNOT_BE_REMOVED` (409) with shared-problem examples.
- [x] Redocly lint clean; regenerate Orval clients (frontend) and NestJS client for meter/reading consumption paths.

R1.2 Migration (`db/migration/households/`)
- [x] Extend `MembershipRole` with `VIEWER` (check constraint / enum migration).
- [x] Replace `UNIQUE (household_id)` on `household_members` with `UNIQUE (household_id, user_id)`; backfill nothing (existing rows stay OWNER).
- [x] New `household_invites` table: `id`, `household_id`, `role`, `code_hash`, `created_by`, `expires_at`, `redeemed_at` nullable, `redeemed_by` nullable — codes hashed like refresh tokens. (jOOQ DDLDatabase codegen can't simulate `DROP CONSTRAINT` — runtime-only drops wrapped in `/*[ignore]*/` with final shape expressed directly; also added `revoked_at` for invite revocation.)
- [x] Verify migration up/down against a copy of a populated MVP database (existing single-owner household must survive untouched).

## Epic R2 — Household service: membership, invites, members

R2.1 Role model & membership resolution
- [x] Domain: membership per (household, user); creator stays OWNER; owner role immutable; removing owner rejected.
- [x] Every authorization path resolves through the requester's membership — no "creator ⇒ trusted" shortcut left in `HouseholdService`.

R2.2 Members API
- [x] `GET /api/v1/households/{id}/members` — any member of that household (403-masked otherwise, no enumeration).
- [x] `DELETE /api/v1/households/{id}/members/{userId}` — owner-only; reject self-removal and owner target (`409 OWNER_CANNOT_BE_REMOVED`).

R2.3 Invites
- [x] `POST .../invites` — owner-only, target role MEMBER|VIEWER, high-entropy code returned once in plaintext, stored hashed, 7-day expiry.
- [x] Bounded live invites per household (10) — 409-style rejection beyond.
- [x] `GET .../invites` — owner-only, live (unredeemed, unexpired) only, no code material.
- [x] `DELETE .../invites/{inviteId}` — owner-only revoke.

R2.4 Redeem
- [x] `POST /api/v1/households/invites/redeem` — any authenticated user; single-use (used → `409`, expired → `410`, unknown → `404`).
- [x] Idempotent for an existing member (no-op success, never an error).
- [x] Transactional: redemption + membership creation atomic; race on last code use must not double-create membership (unique constraint backstop).

R2.5 Households list/get with role
- [x] `GET /api/v1/households` returns every household the caller has *any* membership in, each with caller's role — replaces implicit "I own everything returned".
- [x] `GET /api/v1/households/{id}` for a non-member stays enumeration-safe (404, same as today).

R2.6 Internal access endpoint
- [x] `GET /api/v1/internal/household-access?householdId=&userId=` — verdict `{role, exists}`; narrow accessor, no membership details beyond the pair.
- [x] `permitAll` on the internal surface (A1 trust model, like the revocation feed), documented as revisited when A1 lands.
- [x] Unit + integration tests: role matrix in household-service (OWNER/MEMBER/VIEWER/non-member × every endpoint), invite lifecycle (create→redeem→reused/expired/revoked), owner-protection paths.

## Epic R3 — Meter service: role-aware authorization

- [x] Replace household-existence check with the internal access verdict: new `InternalHouseholdApiProvider` + request-scoped `HouseholdAccessService` against `/api/v1/internal/household-access`, process-wide `VerdictCache` with 30 s TTL (cache is singleton, API request-scoped — NestJS scope propagation avoided by splitting them). (Verified live: re-invited member denied for ≤30 s after redemption, then allowed.)
- [x] Reads (list/get meters) require any membership role; create/modify meter requires MEMBER+; VIEWER gets `403 FORBIDDEN_ROLE`; not-a-member keeps today's enumeration-safe masking (404, do not reveal existence). (Live: viewer read 200 / create+patch 403 FORBIDDEN_ROLE; outsider list+get 404 with the same problem bodies as before.)
- [x] Household unreachable → fail closed (503 `HOUSEHOLD_SERVICE_UNAVAILABLE`), same as today. (E2e: cold verdict during outage → 503.)
- [x] Update e2e spec: VIEWER can read but not create/patch; non-member unchanged (404s); owner+member can write. (19/19 e2e, 33/33 unit, stub in `global-setup.ts` now answers the internal verdict protocol with `grantRole`/`revokeMembership` fixtures.)
- Contract note: meter-service openapi bumped to 1.1.0 with FORBIDDEN_ROLE 403 examples on create/patch; the 30 s stale-allow window after a removal is the accepted §11 trade-off and documented on the access service.

## Epic R4 — Reading service: role-aware authorization

- [x] Same internal-verdict check on the reading path, resolving meter → household via meter-service (existing chain), per-request check with the same short-TTL cache discipline as R3 — a dedicated access-verdict service called at the top of each handler, mirroring `MeterService`. (Reading-service now generates the household internal client; `HouseholdAccessService` + `VerdictCache` + `InternalHouseholdApiProvider` mirror R3; `MeterAccessService.assertAccessible` returns the meter so the submission handler resolves its `householdId`; compose gains `HOUSEHOLD_SERVICE_URL` for reading-service.)
- [x] Reads need any role; submissions need MEMBER+ (`403 FORBIDDEN_ROLE` for VIEWER); non-member and foreign-meter denials unchanged (404 masking). (Reads rely on meter-service's role-aware visibility mask alone — a 200 from `getMeter` already proves any-role membership, so no verdict call is spent on reads. Submissions → `assertCanWrite`; `HouseholdNotFoundException` re-masked to `METER_NOT_FOUND` so no household existence leaks; household unreachable → 503 `HOUSEHOLD_SERVICE_UNAVAILABLE` fail-closed. Unit 51/51.)
- [x] Update e2e spec to cover VIEWER read / write-reject and non-member isolation. (`test/reading-roles.e2e-spec.ts` — viewer read 200 + submit 403 FORBIDDEN_ROLE, member submits 201, removed member re-denied after cache clear, non-member foreign/unknown share the same 404, household-down 503 on submission; global-setup stub now answers the internal verdict protocol with `grantRole`/`revokeMembership` fixtures. 29/29 e2e.)
- Contract note: reading-service openapi bumped 1.1.0 with FORBIDDEN_ROLE 403 on `POST /readings` and role-aware descriptions on the read paths.

## Epic R5 — Frontend (Next.js)

- [x] Regenerate household client from R1 contract; surface `role` on household models.
- [x] Households where the caller is VIEWER hide write affordances (add-meter, submit-reading) — API still rejects as backstop.
- [x] "Members" surface on household details: member list, invite creation with copy code, invite list + revoke — visible to OWNER only.
- [x] Redeem flow: inline "Join household" dialog on the households list with a paste-code field (spec §11 decision); success adds household to the list.
- [x] Error states for new problem codes (`FORBIDDEN_ROLE`, invite errors, `OWNER_CANNOT_BE_REMOVED`).
- [x] `tsc --noEmit`, eslint, `next build` clean; verify member/owner/VIEWER journeys via Playwright against Compose. (Live run 2026-09-30: owner created household + meter + MEMBER/VIEWER invites; member redeemed → saw household with write buttons, submitted 1,042 kWh; viewer redeemed → read-only card (only History), no Members panel; bogus code → 404 sentence; reused code → 409 sentence.)

## Epic R6 — Gateway & routing

- [x] Confirm `/api/v1/households/**` routing covers the new invite/member paths (it does — prefix-based, verified live).
- [x] `denyAll` for proxied `/api/v1/internal/household-access` (mirror A4's identity internal path), test included. (Also fixed the gateway image build, broken since A4: Dockerfile now mounts the shared contracts context for openapi-generator.)

## Epic R7 — End-to-end verification & docs

- [ ] Extend `e2e/journey.e2e.test.mjs` (or sibling file) with a multi-user roles journey: owner creates household → invite MEMBER → B redeems → B sees household/meters/readings → B submits reading → owner invites VIEWER → C reads but cannot write (`FORBIDDEN_ROLE`) → owner removes B → B loses access within cache TTL → used/expired/revoked code error paths → single-owner flow still green (PRD acceptance: original journey untouched).
- [ ] Verify cross-service matrix live through gateway: household, meter, reading services all reject per §7 table.
- [ ] Docs: `docs/service-boundaries.md` §Household Roles and `docs/api-examples.md` gain the new endpoints/error codes; README e2e section mentions the roles journey.
- [ ] Backlog A3 → Resolved with a dated resolution paragraph (A4-style).
