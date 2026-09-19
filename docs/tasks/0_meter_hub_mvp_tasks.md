# Home Metering — MVP Task Breakdown

## Epic 0 — Project Foundation

### 0.1 Create repository structure
- [x] Create monorepo or repository structure for frontend, services, infrastructure, and contracts.
- [x] Add README with project purpose and local setup.
- [x] Define naming conventions and service ports.
- [x] Add basic `../../.gitignore`, `.editorconfig`, and environment example files.

### 0.2 Define service boundaries
- [x] Document responsibility of Identity Service.
- [x] Document responsibility of Household Service.
- [x] Document responsibility of Meter Service.
- [x] Document responsibility of Reading Service.
- [x] Document database ownership rules.

### 0.3 Define shared API conventions
- [x] Define API versioning convention.
- [x] Define UUID format for IDs.
- [x] Define timestamp format and UTC requirement.
- [x] Define common error response.
- [x] Define correlation/request ID header.
- [x] Create initial OpenAPI contract structure.

---

## Epic 1 — Local Infrastructure

### 1.1 Docker Compose
- [x] Create Docker Compose base file.
- [x] Add PostgreSQL.
- [x] Create persistent PostgreSQL volume.
- [x] Add environment variable configuration.
- [x] Add health checks.

### 1.2 Service networking
- [x] Create internal Docker network.
- [x] Define stable service DNS names.
- [x] Document external vs internal ports.

### 1.3 Database initialization
- [x] Create Identity database/schema.
- [x] Create Household database/schema.
- [x] Create Meter database/schema.
- [x] Create Reading database/schema.
- [x] Ensure each service only uses its own database/schema credentials.

---

## Epic 2 — Identity Service — Spring Boot

### 2.1 Bootstrap service
- [x] Create Spring Boot project.
- [x] Add Spring Web.
- [x] Add Spring Security.
- [x] Add persistence dependencies.
- [x] Configure PostgreSQL.
- [x] Add Flyway or Liquibase migrations.

### 2.2 User model
- [x] Create User entity.
- [x] Add unique email/username constraint.
- [x] Add account status.
- [x] Add created/updated timestamps.

### 2.3 Registration
- [x] Implement `POST /api/v1/auth/register`.
- [x] Validate input.
- [x] Hash password.
- [x] Persist user.
- [x] Handle duplicate identity errors.

### 2.4 Login
- [x] Implement `POST /api/v1/auth/login`.
- [x] Validate credentials.
- [x] Generate access token.
- [x] Return token metadata.

### 2.5 Refresh tokens
- [x] Create refresh token model.
- [x] Implement refresh token rotation or revocation strategy.
- [x] Implement `POST /api/v1/auth/refresh`.
- [x] Implement `POST /api/v1/auth/logout`.

### 2.6 Current user
- [x] Implement `GET /api/v1/users/me`.
- [x] Return stable user identity information.

### 2.7 Security tests
- [x] Test password hashing.
- [x] Test invalid login.
- [x] Test expired/invalid token.
- [x] Test refresh token revocation.

---

## Epic 3 — API Gateway — Spring Cloud Gateway

### 3.1 Bootstrap gateway
- [x] Create Spring Cloud Gateway project.
- [x] Configure service routes.
- [x] Add Docker image.

### 3.2 Routing
- [x] Route `/api/v1/auth/**` to Identity Service.
- [x] Route `/api/v1/users/**` to Identity Service.
- [x] Route `/api/v1/households/**` to Household Service.
- [x] Route `/api/v1/meters/**` to Meter Service.
- [x] Route `/api/v1/readings/**` to Reading Service.

### 3.3 Authentication
- [x] Configure JWT validation at the gateway.
- [x] Allow public access to registration/login/refresh endpoints.
- [x] Require authentication for protected routes.
- [x] Propagate authenticated identity where required.

### 3.4 Cross-cutting concerns
- [x] Generate or propagate request/correlation ID.
- [x] Add access logging.
- [x] Configure CORS.
- [x] Configure request timeouts.
- [x] Add basic rate limiting design; implementation may be deferred.

---

## Epic 4 — Household Service — Spring Boot

### 4.1 Bootstrap service
- [x] Create Spring Boot project.
- [x] Configure PostgreSQL.
- [x] Configure migration tool.
- [x] Add service health endpoint.

### 4.2 Household model
- [x] Create Household entity.
- [x] Create household owner/membership model.
- [x] Add created/updated timestamps.

### 4.3 APIs
- [x] Implement `POST /api/v1/households`.
- [x] Implement `GET /api/v1/households`.
- [x] Implement `GET /api/v1/households/{householdId}`.

### 4.4 Authorization
- [x] Extract user identity from JWT/security context.
- [x] Restrict household queries to the authenticated user.
- [x] Add unauthorized access tests.

---

## Epic 5 — Meter Service — NestJS

### 5.1 Bootstrap service
- [x] Create NestJS project.
- [x] Configure PostgreSQL.
- [x] Select and configure ORM/query library.
- [x] Configure database migrations.
- [x] Add health endpoint.

### 5.2 Meter model
- [x] Create Meter entity/model.
- [x] Add household ID.
- [x] Add meter type.
- [x] Add name/label.
- [x] Add serial number.
- [x] Add unit.
- [x] Add status.
- [x] Add timestamps.

### 5.3 APIs
- [x] Implement `POST /api/v1/meters`.
- [x] Implement `GET /api/v1/meters` by household.
- [x] Implement `GET /api/v1/meters/{meterId}`.
- [x] Implement `PATCH /api/v1/meters/{meterId}`.

### 5.4 Authorization
- [x] Validate JWT or propagated authentication context.
- [x] Verify that the current user owns the referenced household.
- [x] Prevent access to another user's meter.

### 5.5 Validation
- [x] Validate supported meter types.
- [x] Validate required fields.
- [x] Define serial number uniqueness policy.

Policy: `serialNumber` is unique per `householdId` (a manufacturer serial
identifies one physical meter, but identical devices can exist in different
households). The reservation persists after the meter is ARCHIVED. Violations
return `409 METER_SERIAL_NUMBER_CONFLICT`; the rule is enforced by a DB unique
index on `(household_id, serial_number)` in meter-db.

---

## Epic 6 — Reading Service — NestJS

### 6.1 Bootstrap service
- [x] Create NestJS project.
- [x] Configure PostgreSQL.
- [x] Configure database migrations.
- [x] Add health endpoint.

### 6.2 Reading model
- [x] Create Reading entity/model.
- [x] Add meter ID.
- [x] Add numeric reading value.
- [x] Add `recordedAt`.
- [x] Add `source`.
- [x] Add `createdAt`.

### 6.3 Create reading
- [x] Implement `POST /api/v1/readings`.
- [x] Validate non-negative values.
- [x] Validate timestamp.
- [x] Set source to `MANUAL` for MVP.

### 6.4 Reading lookup
- [x] Implement `GET /api/v1/meters/{meterId}/readings`.
- [x] Implement `GET /api/v1/meters/{meterId}/readings/latest`.
- [x] Add sorting by recorded timestamp.
- [x] Add pagination for history.

### 6.5 Cross-service authorization
- [x] Verify the meter exists and belongs to the authenticated user.
- [x] Decide and document whether this check uses Meter Service API or an internal cached projection.
- [x] Do not access Meter Service database directly.

Decision: every reading operation calls Meter Service's `GET /api/v1/meters/{meterId}`
(`MeterAccessService`) before touching reading data. No cached projection — the
MVP volume makes per-request checks cheap, and a projection would introduce
staleness on revocation (archiving/sharing a meter must cut off reads
immediately). The caller's access token is forwarded, so Meter Service applies
the same ownership masking as its own endpoints; unknown and foreign meters both
return `METER_NOT_FOUND`. Failures fail closed with `503
METER_SERVICE_UNAVAILABLE`. Reading Service never accesses meter-db directly.

### 6.6 Reading business rules
- [x] Load the previous reading for cumulative meters.
- [x] Reject decreasing readings unless a correction strategy explicitly allows them.
- [x] Return a stable business error code for invalid readings.
- [x] Add tests for first reading, equal reading, increasing reading, and decreasing reading.

Rule: all MVP meter types are cumulative counters, so a new reading must not
be lower than the previous reading recorded strictly before it (compared in
`recordedAt` order, not creation order — backdated entries compare against
their own past). Violations return `422 READING_DECREASING` with a
`value` field error. Corrections are out of MVP scope; history is never
overwritten.

---

## Epic 7 — Frontend — Next.js

### 7.1 Bootstrap frontend
- [x] Create Next.js application with TypeScript.
- [x] Configure environment variables.
- [x] Configure API base URL.
- [x] Add basic layout/navigation.

Bootstrap decisions: Next.js 16 (App Router, `src/` dir, `@/*` alias) with
Material UI 9 integrated per the official Next.js App Router guide —
`AppRouterCacheProvider` (`enableCssLayer: true` so MUI styles win over
`globals.css`-style resets), `InitColorSchemeScript`, and a client
`ThemeProvider` boundary with `cssVariables` + light/dark color schemes so the
app follows the system preference without a hydration flash. The API gateway
base URL is `NEXT_PUBLIC_API_URL` (`.env.example` provided; defaults to
`http://localhost:8080`) and is exposed through `src/lib/api.ts`.

UI design: the app follows the free Devias Kit
(`mui.com/store/items/devias-kit`, MIT-licensed). Its theme system (color
schemes with neutral shades, soft shadows, rounded buttons/cards, table
styles) was ported into `src/theme/`, and the dashboard shell (fixed dark
side nav, sticky top bar, mobile drawer) into
`src/components/layout/` — adapted to MUI 9 (`@mui/icons-material`
instead of Phosphor, `slotProps.paper` instead of `PaperProps`) and wired
through our existing `AppRouterCacheProvider` / `InitColorSchemeScript`
setup. Frontend routes use top-level paths under a `(dashboard)` route group (shared
auth-guarded shell): `/households`, `/meters`, `/readings`, `/settings`.
There is no `/dashboard` route; the group directory is purely structural.

### 7.2 Authentication UI
- [x] Create registration page.
- [x] Create login page.
- [x] Store authentication state securely according to selected architecture.
- [x] Implement logout.
- [x] Handle expired access token.

Auth architecture: Next.js BFF pattern. The browser only talks to Next.js
route handlers (`/api/auth/login|sign-up|refresh|logout|session`); the
refresh token lives in an httpOnly, SameSite=Lax cookie (`meterhub_refresh`)
and never reaches client JS. The access token is held in memory only
(module state in `src/lib/auth/auth-client.ts`) and attached as a Bearer
header by `authedFetch`, which retries once through a silent refresh on a
401. The identity service's refresh tokens are single-use, so every
successful refresh rotates the cookie; an invalid refresh clears it and
forces re-login. Logout revokes the token server-side and clears the
cookie. `AuthProvider` + `AuthGuard`/`GuestGuard` (Devias Kit pattern)
resolve the session on boot via silent refresh.

API client generation: Orval (`npm run generate:api`) reads the versioned
contracts in `contracts/openapi/services/*` and emits TanStack Query hooks +
typed models under `src/lib/api/generated/` (one module per service). All
generated calls go through a custom fetch mutator (`orval-mutator.ts`) that
attaches the in-memory Bearer access token and retries once via silent
refresh on 401, throwing `ApiError` carrying the RFC 9457 problem body on
failure. Queries get a 30s stale time and skip retries on 4xx.
`parserOptions.externalRefs.allow` lists the shared contract files the
service specs reference (`../../openapi.yaml`, correlation-id header,
problem schema). The identity-service client is generated too and used on
both sides: BFF route handlers call `loginUser`/`refreshToken`/
`logoutUser`/`registerUser` server-side (the mutator resolves absolute
gateway URLs when `window` is undefined), and the browser registers
directly through the generated `registerUser` — while login/refresh/
logout still go through the BFF routes so the refresh token never enters
client JS. The generated `useGetCurrentUser` hook feeds the auth context.
Browser API calls use relative `/api/v1/...` URLs proxied to the gateway
by a Next.js rewrite (same-origin, no CORS preflights).

### 7.3 Household UI
- [x] Create household list.
- [x] Create household form.
- [x] Create household details page.

All data flows through the Orval-generated household-service client
(`useListHouseholds`, `useGetHousehold`, `useCreateHousehold`) with the
shared status-narrowing helpers (`src/lib/api/problems.ts`, extracted from
auth-client so any feature can use them). List page at
`/dashboard/households` with empty state and create dialog; details at
`/dashboard/households/[householdId]` surfacing problem details (404 shows
the backend `detail`). Side-nav household box is now live: shows the most
recent household, links to the list. Verified end-to-end via Playwright MCP
against docker compose (create → card + side-nav update → details → 404
problem → required-name validation → cancel).

### 7.4 Meter UI
- [x] Show meters for selected household.
- [x] Create add-meter form.
- [x] Create edit/archive meter action.
- [x] Display meter type, unit, serial number, and latest reading.

### 7.5 Reading UI
- [x] Create add-reading form.
- [x] Show latest reading.
- [x] Show reading history.
- [x] Show validation/business errors clearly.

### 7.6 Basic UX
- [x] Add loading states.
- [x] Add empty states.
- [x] Add error states.
- [x] Prevent duplicate form submissions.

Loading: skeleton rows in the lists (`households-list`, `meters-list`)
and a centered `CircularProgress` in `AuthGuard` while the session
resolves (previously a blank page on hard refresh of a protected page).
Empty: households ("No households yet" + create shortcut), meters, and
reading history ("No readings yet"). Errors: lists/details show the backend
problem message plus a Retry button that refetches the failed query;
dialog errors land on their fields or as a root alert. Duplicate
submissions: all submit buttons disable while the mutation is pending —
now with MUI v9's `loading` prop so the disabled state also shows a
spinner (household/meter/reading create, meter edit, sign-in, sign-up).
Verified with `tsc --noEmit`, eslint, and `next build` all clean.

---

## Epic 8 — End-to-End Integration

### 8.1 Authentication flow
- [x] Register through Gateway.
- [x] Login through Gateway.
- [x] Call protected endpoint with JWT.
- [x] Verify unauthorized requests return 401.

Verified with curl against docker compose (gateway `localhost:8080`). Public
paths are service-prefixed (`/api/identity-service/api/v1/auth/**`), matching
the gateway routes and the web client's rewrites: register → 201, login → 200
(access + rotating refresh token, 900s access TTL), `GET /users/me` with the
access token → 200 with the correct user id/email. Missing, malformed, and
expired tokens on a protected route (`GET /api/household-service/...`) all
return `401` as an RFC 9457 problem (`UNAUTHORIZED` / `INVALID_TOKEN` with a
correlationId).

### 8.2 Household flow
- [x] Create household through Gateway.
- [x] Fetch household list.

Verified with curl against docker compose, using the access token from the
8.1 user: `POST /api/household-service/api/v1/households` → 201 (id, name,
timestamps echoed back), then `GET .../households` → 200 listing exactly that
household, scoped to the token's user.

### 8.3 Meter flow
- [x] Add meter to household.
- [x] Fetch meters for household.
- [x] Update meter.
- [x] Archive meter.

Verified with curl against docker compose, same user/household as 8.2. Meters
live at `/api/meter-service/api/v1/meters` with `householdId` in the create
body (not nested under /households/{id}/meters): `POST` → 201 (ELECTRICITY /
KWH, status ACTIVE), `GET ?householdId=` → 200 with the meter, `PATCH` rename
→ 200 (name + updatedAt changed), `PATCH {"status":"ARCHIVED"}` → 200
(ACTIVE → ARCHIVED).

### 8.4 Reading flow
- [x] Create manual reading.
- [x] Fetch latest reading.
- [x] Fetch history.

Verified with curl against docker compose, same user as 8.1-8.3 (readings
posted against the ARCHIVED meter from 8.3 still succeed, matching "archiving
keeps historical readings addressable"). `POST /api/reading-service/api/v1/readings`
(`meterId` in body, `source: MANUAL`) → 201 twice; `GET .../meters/{id}/readings/latest`
→ 200 returns the newest by `recordedAt` (1310.25, not the later-created 1250.5);
`GET .../meters/{id}/readings` → 200 lists both, newest first.

### 8.5 Security flow
- [x] Verify User A cannot read User B's household.
- [x] Verify User A cannot read User B's meter.
- [x] Verify User A cannot create a reading for User B's meter.

Verified with curl against docker compose: a second user B registered and
created their own household + gas meter; User A's token was then used against
B's resources. `GET /households/{B's id}` → 404 `HOUSEHOLD_NOT_FOUND`;
`GET /meters?householdId={B's}` → 404; `GET /meters/{B's id}` → 404
`METER_NOT_FOUND`; `POST /readings` for B's meter → 404; additionally
`GET /meters/{B's}/readings` (history) → 404. All denials are resource-not-found
(ownership scoping, not 403), so existence is not leaked. Control checks: with
their own token B still gets 200 on the meter and 201 on a reading.

---

## Epic 9 — Contracts and Testing

### 9.1 OpenAPI
- [x] Define Identity API OpenAPI contract.
- [x] Define Household API OpenAPI contract.
- [x] Define Meter API OpenAPI contract.
- [x] Define Reading API OpenAPI contract.
- [x] Publish contracts in repository.

All four contracts live in `contracts/openapi/services/<service>/openapi.yaml`,
sharing the root `contracts/openapi/openapi.yaml` (Problem schema, correlation
ID header, common error responses). Verified against the implementations:
identity/household controllers implement the generated `*Api` interfaces and
meter/reading services extend the generated NestJS server stubs, so paths,
schemas, and status codes match the deployed behavior (including 8.5's
ownership-scoped 404s and the meter/reading 401 problem examples). Reading
contract's 401 responses were still pre-auth placeholders ("reserved"
comments) — replaced with the shared `UnauthorizedProblem` response (missing
token / invalid token examples) matching the other contracts. All five
documents lint clean with Redocly; regenerating the reading-service stubs
from the updated contract produced byte-identical code.

### 9.2 Unit tests
- [x] Add domain/service tests for each backend service.
- [x] Add validation tests.
- [x] Add authorization tests.

Meter and reading services already had full Vitest unit suites for their
service and repository layers (meter: 20 tests incl. serial-conflict mapping
and empty-update rejection; reading: 34 tests incl. paging bounds, UTC
normalization, non-decreasing rule, and meter-access gating). The gap was the
Java services, which only had Spring integration tests: added pure unit tests
with Mockito — identity `AuthServiceTest` (13 tests: login credential/status
rejection paths that all map to the same 401, refresh rotation with hash-only
storage, expiry/revocation/inactive-account rejection, idempotent logout) and
`UserServiceTest` (6 tests: password hashing, email/username uniqueness with
field attribution, current-user lookup), household `HouseholdServiceTest`
(7 tests: owner-member creation with consistent timestamps, owner-scoped
listing, ownership-scoped 404 indistinguishable from unknown household).
All green: identity 19, household 7, meter 20, reading 34.

### 9.3 Integration tests
- [x] Test each service against PostgreSQL.
- [x] Test Gateway routing.
- [x] Test JWT validation.
- [x] Test cross-service authorization behavior.

Most of this coverage already existed from epics 2–6 and was verified by
running it against the running Compose PostgreSQL: identity (29 tests across
registration/login/refresh/me against the real DB via Flyway+jooq), household
(8 authz tests), gateway (16 tests: JWT validation paths — missing/invalid/
expired/wrong-issuer/wrong-audience/wrongly-signed tokens — plus correlation
ID and CORS). Cross-service authorization was covered by meter e2e (household
ownership gating, enumeration-safe 404s, fail-closed) and reading e2e
(meter-service ownership checks, 503 fail-closed). The gap was explicit
gateway routing tests: added `GatewayRoutingIntegrationTest` (3 tests) — one
stub server stands in for all four downstreams via the route table's own
`*_SERVICE_URL` placeholders, asserting each `/api/<service>/...` prefix
strips to the contract path, the Authorization header propagates verbatim,
and an unknown service prefix never reaches a downstream (401 unauthenticated,
404 authenticated — security runs before routing). Also fixed three stale
expectations in `meter-authorization.e2e-spec.ts` left behind by the "add
error handling" rework: enumeration-safety diffs now strip the request-scoped
`detail` field (like the reading spec), and household-unreachable maps to 503
`HOUSEHOLD_SERVICE_UNAVAILABLE` per the 6.5 fail-closed decision, not 502.
All suites green: gateway 19, identity 48 (29 integration + 19 unit),
household 15, meter 36 (16 e2e + 20 unit), reading 49 (15 e2e + 34 unit).

### 9.4 End-to-end test
- [x] Automate registration → login → household → meter → reading → history.
- [x] Run E2E test against Docker Compose environment.

`e2e/journey.e2e.test.mjs` (Node's built-in test runner, no new dependencies)
drives the gateway at `http://localhost:8080` (`GATEWAY_URL` overridable)
against the running Compose stack with nothing mocked. Journey test:
registration (with duplicate-email 409), login (with enumeration-safe wrong
password), /users/me, household create/list/get, meter create/list (with
serial-number 409), two readings in the past, READING_DECREASING rejection,
history newest-first, latest reading, refresh-token rotation (old token
consumed — reuse fails identically to unknown), and logout revocation. A
second test registers two more users and verifies cross-user isolation:
foreign household and meter both masked behind the same 404s, readings into
a foreign meter rejected, household list scoped to the caller. Every run
mints unique emails/usernames so it is idempotent against a persistent DB.
Run with `node --test e2e/journey.e2e.test.mjs` (documented in README §"Run
the end-to-end journey test"). Both tests pass against the live Compose
environment.

---

## Epic 10 — Observability and Developer Experience

### 10.1 Logging
- [ ] Standardize structured log format.
- [ ] Include request/correlation ID.
- [ ] Avoid logging passwords/tokens/secrets.

### 10.2 Health checks
- [ ] Add liveness endpoints.
- [ ] Add readiness endpoints.
- [ ] Verify database dependency status where appropriate.

### 10.3 Local developer experience
- [ ] Add one-command startup documentation.
- [ ] Add one-command database reset for development.
- [ ] Document service ports.
- [ ] Document environment variables.

### 10.4 Basic metrics
- [ ] Expose basic application metrics where supported.
- [ ] Track HTTP request count and latency.
- [ ] Track error count.

---

## Epic 11 — MVP Release

### 11.1 Documentation
- [ ] Write architecture overview.
- [ ] Write local setup guide.
- [ ] Write API usage examples.
- [ ] Document data ownership boundaries.
- [ ] Document known limitations.

### 11.2 MVP acceptance
- [ ] Clean checkout starts successfully with Docker Compose.
- [ ] User can register and log in.
- [ ] User can create a household.
- [ ] User can add a meter.
- [ ] User can add a manual reading.
- [ ] User can view reading history.
- [ ] User data is isolated from other users.
- [ ] Data survives service/container restart.

---

# Suggested Implementation Order

The following order minimizes the amount of unfinished cross-service work:

1. [ ] Project foundation and repository structure.
2. [ ] Docker Compose + PostgreSQL.
3. [ ] Identity Service.
4. [ ] API Gateway.
5. [ ] Household Service.
6. [ ] Meter Service.
7. [ ] Reading Service.
8. [ ] First full backend flow through Gateway.
9. [ ] Next.js frontend.
10. [ ] End-to-end security tests.
11. [ ] OpenAPI/contracts.
12. [ ] Observability and developer-experience improvements.
13. [ ] MVP release.

# Deferred Technical Experiments

These should be added only after the synchronous MVP works:

- [ ] Kafka.
- [ ] Transactional outbox.
- [ ] Event-driven `ReadingCreated` event.
- [ ] Idempotent event consumers.
- [ ] Retry and dead-letter handling.
- [ ] Redis rate limiting/cache.
- [ ] OpenTelemetry distributed tracing.
- [ ] Prometheus/Grafana/Loki.
- [ ] Kubernetes + Helm.
