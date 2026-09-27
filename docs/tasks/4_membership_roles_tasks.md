# Household Membership Roles — Task Breakdown

Spec: [../spec/4_membership_roles_spec.md](../spec/4_membership_roles_spec.md) (backlog A3, depends on A4's internal-feed pattern).
Workflow mirrors the metrics (M1–M3) and log-aggregation (L1–L3) breakdowns: tick a box only after live verification, record detours honestly. Open questions from the spec are resolved there (§11): inline redeem dialog, owner-only invites, per-request access-verdict call.

Service reality this builds on (verified 2026-09-27):

- household-service currently has a single-row-per-household `household_members` table (`UNIQUE household_id`, role `OWNER` only) and only `POST/GET /households` APIs.
- meter-service checks household *existence* only (`HouseholdService.getHousehold` → 404 masking); reading-service checks meter *access* the same way (`MeterAccessService`). Neither knows about roles.
- A4 landed the pattern this PRD reuses: internal endpoint on `permitAll` internal surface, gateway `denyAll` on proxied `/api/v1/internal/**`, compact poll/cached response.

## Epic R1 — Contract & data model (household-service)

R1.1 OpenAPI contract update (`contracts/openapi/services/household-service/openapi.yaml`)
- [x] New public paths: `POST/GET /api/v1/households/{householdId}/invites`, `DELETE .../invites/{inviteId}`, `POST /api/v1/households/invites/redeem`, `GET .../members`, `DELETE .../members/{userId}`.
- [x] `Household` schema gains caller's `role` (OWNER/MEMBER/VIEWER) on list + get responses.
- [x] New internal path `GET /api/v1/internal/household-access?householdId=&userId=` returning `{role, exists}` — mirror A4's `Internal` tag, `security: []`, compact-body rationale comment, "not reachable through gateway" note.
- [x] Error semantics: `HOUSEHOLD_ACCESS_DENIED` (403), `FORBIDDEN_ROLE` (403), `INVITE_NOT_FOUND` (404), `INVITE_EXPIRED` (410), `INVITE_ALREADY_USED` (409), `OWNER_CANNOT_BE_REMOVED` (409) with shared-problem examples.
- [x] Redocly lint clean; regenerate Orval clients (frontend) and NestJS client for meter/reading consumption paths.

R1.2 Migration (`db/migration/households/`)
- [ ] Extend `MembershipRole` with `VIEWER` (check constraint / enum migration).
- [ ] Replace `UNIQUE (household_id)` on `household_members` with `UNIQUE (household_id, user_id)`; backfill nothing (existing rows stay OWNER).
- [ ] New `household_invites` table: `id`, `household_id`, `role`, `code_hash`, `created_by`, `expires_at`, `redeemed_at` nullable, `redeemed_by` nullable — codes hashed like refresh tokens.
- [ ] Verify migration up/down against a copy of a populated MVP database (existing single-owner household must survive untouched).

## Epic R2 — Household service: membership, invites, members

R2.1 Role model & membership resolution
- [ ] Domain: membership per (household, user); creator stays OWNER; owner role immutable; removing owner rejected.
- [ ] Every authorization path resolves through the requester's membership — no "creator ⇒ trusted" shortcut left in `HouseholdService`.

R2.2 Members API
- [ ] `GET /api/v1/households/{id}/members` — any member of that household (403-masked otherwise, no enumeration).
- [ ] `DELETE /api/v1/households/{id}/members/{userId}` — owner-only; reject self-removal and owner target (`409 OWNER_CANNOT_BE_REMOVED`).

R2.3 Invites
- [ ] `POST .../invites` — owner-only, target role MEMBER|VIEWER, high-entropy code returned once in plaintext, stored hashed, 7-day expiry.
- [ ] Bounded live invites per household (10) — 409-style rejection beyond.
- [ ] `GET .../invites` — owner-only, live (unredeemed, unexpired) only, no code material.
- [ ] `DELETE .../invites/{inviteId}` — owner-only revoke.

R2.4 Redeem
- [ ] `POST /api/v1/households/invites/redeem` — any authenticated user; single-use (used → `409`, expired → `410`, unknown → `404`).
- [ ] Idempotent for an existing member (no-op success, never an error).
- [ ] Transactional: redemption + membership creation atomic; race on last code use must not double-create membership (unique constraint backstop).

R2.5 Households list/get with role
- [ ] `GET /api/v1/households` returns every household the caller has *any* membership in, each with caller's role — replaces implicit "I own everything returned".
- [ ] `GET /api/v1/households/{id}` for a non-member stays enumeration-safe (404, same as today).

R2.6 Internal access endpoint
- [ ] `GET /api/v1/internal/household-access?householdId=&userId=` — verdict `{role, exists}`; narrow accessor, no membership details beyond the pair.
- [ ] `permitAll` on the internal surface (A1 trust model, like the revocation feed), documented as revisited when A1 lands.
- [ ] Unit + integration tests: role matrix in household-service (OWNER/MEMBER/VIEWER/non-member × every endpoint), invite lifecycle (create→redeem→reused/expired/revoked), owner-protection paths.

## Epic R3 — Meter service: role-aware authorization

- [ ] Replace household-existence check with the internal access verdict: new provider against `/api/v1/internal/household-access`, short-TTL in-JVM cache (30 s, A4-style poll/lookup — decide request-path fetch vs. poll per measured call cost).
- [ ] Reads (list/get meters) require any membership role; create/modify meter requires MEMBER+; VIEWER gets `403 FORBIDDEN_ROLE`; not-a-member keeps today's enumeration-safe masking (404, do not reveal existence).
- [ ] Household unreachable → fail closed (503 `HOUSEHOLD_SERVICE_UNAVAILABLE`), same as today.
- [ ] Update e2e spec: VIEWER can read but not create/patch; non-member unchanged (404s); owner+member can write.

## Epic R4 — Reading service: role-aware authorization

- [ ] Same internal-verdict check on the reading path, resolving meter → household via meter-service (existing chain), per-request check with the same short-TTL cache discipline as R3 — a dedicated access-verdict service called at the top of each handler, mirroring `MeterAccessService`.
- [ ] Reads need any role; submissions need MEMBER+ (`403 FORBIDDEN_ROLE` for VIEWER); non-member and foreign-meter denials unchanged (404 masking).
- [ ] Update e2e spec to cover VIEWER read / write-reject and non-member isolation.

## Epic R5 — Frontend (Next.js)

- [ ] Regenerate household client from R1 contract; surface `role` on household models.
- [ ] Households where the caller is VIEWER hide write affordances (add-meter, submit-reading) — API still rejects as backstop.
- [ ] "Members" surface on household details: member list, invite creation with copy code, invite list + revoke — visible to OWNER only.
- [ ] Redeem flow: inline "Join household" dialog on the households list with a paste-code field (spec §11 decision); success adds household to the list.
- [ ] Error states for new problem codes (`FORBIDDEN_ROLE`, invite errors, `OWNER_CANNOT_BE_REMOVED`).
- [ ] `tsc --noEmit`, eslint, `next build` clean; verify member/owner/VIEWER journeys via Playwright against Compose.

## Epic R6 — Gateway & routing

- [ ] Confirm `/api/v1/households/**` routing covers the new invite/member paths (it should, prefix-based — verify, don't assume).
- [ ] `denyAll` for proxied `/api/v1/internal/household-access` (mirror A4's identity internal path), test included.

## Epic R7 — End-to-end verification & docs

- [ ] Extend `e2e/journey.e2e.test.mjs` (or sibling file) with a multi-user roles journey: owner creates household → invite MEMBER → B redeems → B sees household/meters/readings → B submits reading → owner invites VIEWER → C reads but cannot write (`FORBIDDEN_ROLE`) → owner removes B → B loses access within cache TTL → used/expired/revoked code error paths → single-owner flow still green (PRD acceptance: original journey untouched).
- [ ] Verify cross-service matrix live through gateway: household, meter, reading services all reject per §7 table.
- [ ] Docs: `docs/service-boundaries.md` §Household Roles and `docs/api-examples.md` gain the new endpoints/error codes; README e2e section mentions the roles journey.
- [ ] Backlog A3 → Resolved with a dated resolution paragraph (A4-style).
