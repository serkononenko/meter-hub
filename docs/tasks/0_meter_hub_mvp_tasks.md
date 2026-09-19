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
- [ ] Create Reading entity/model.
- [ ] Add meter ID.
- [ ] Add numeric reading value.
- [ ] Add `recordedAt`.
- [ ] Add `source`.
- [ ] Add `createdAt`.

### 6.3 Create reading
- [ ] Implement `POST /api/v1/readings`.
- [ ] Validate non-negative values.
- [ ] Validate timestamp.
- [ ] Set source to `MANUAL` for MVP.

### 6.4 Reading lookup
- [ ] Implement `GET /api/v1/meters/{meterId}/readings`.
- [ ] Implement `GET /api/v1/meters/{meterId}/readings/latest`.
- [ ] Add sorting by recorded timestamp.
- [ ] Add pagination for history.

### 6.5 Cross-service authorization
- [ ] Verify the meter exists and belongs to the authenticated user.
- [ ] Decide and document whether this check uses Meter Service API or an internal cached projection.
- [ ] Do not access Meter Service database directly.

### 6.6 Reading business rules
- [ ] Load the previous reading for cumulative meters.
- [ ] Reject decreasing readings unless a correction strategy explicitly allows them.
- [ ] Return a stable business error code for invalid readings.
- [ ] Add tests for first reading, equal reading, increasing reading, and decreasing reading.

---

## Epic 7 — Frontend — Next.js

### 7.1 Bootstrap frontend
- [ ] Create Next.js application with TypeScript.
- [ ] Configure environment variables.
- [ ] Configure API base URL.
- [ ] Add basic layout/navigation.

### 7.2 Authentication UI
- [ ] Create registration page.
- [ ] Create login page.
- [ ] Store authentication state securely according to selected architecture.
- [ ] Implement logout.
- [ ] Handle expired access token.

### 7.3 Household UI
- [ ] Create household list.
- [ ] Create household form.
- [ ] Create household details page.

### 7.4 Meter UI
- [ ] Show meters for selected household.
- [ ] Create add-meter form.
- [ ] Create edit/archive meter action.
- [ ] Display meter type, unit, serial number, and latest reading.

### 7.5 Reading UI
- [ ] Create add-reading form.
- [ ] Show latest reading.
- [ ] Show reading history.
- [ ] Show validation/business errors clearly.

### 7.6 Basic UX
- [ ] Add loading states.
- [ ] Add empty states.
- [ ] Add error states.
- [ ] Prevent duplicate form submissions.

---

## Epic 8 — End-to-End Integration

### 8.1 Authentication flow
- [ ] Register through Gateway.
- [ ] Login through Gateway.
- [ ] Call protected endpoint with JWT.
- [ ] Verify unauthorized requests return 401.

### 8.2 Household flow
- [ ] Create household through Gateway.
- [ ] Fetch household list.

### 8.3 Meter flow
- [ ] Add meter to household.
- [ ] Fetch meters for household.
- [ ] Update meter.
- [ ] Archive meter.

### 8.4 Reading flow
- [ ] Create manual reading.
- [ ] Fetch latest reading.
- [ ] Fetch history.

### 8.5 Security flow
- [ ] Verify User A cannot read User B's household.
- [ ] Verify User A cannot read User B's meter.
- [ ] Verify User A cannot create a reading for User B's meter.

---

## Epic 9 — Contracts and Testing

### 9.1 OpenAPI
- [ ] Define Identity API OpenAPI contract.
- [ ] Define Household API OpenAPI contract.
- [ ] Define Meter API OpenAPI contract.
- [ ] Define Reading API OpenAPI contract.
- [ ] Publish contracts in repository.

### 9.2 Unit tests
- [ ] Add domain/service tests for each backend service.
- [ ] Add validation tests.
- [ ] Add authorization tests.

### 9.3 Integration tests
- [ ] Test each service against PostgreSQL.
- [ ] Test Gateway routing.
- [ ] Test JWT validation.
- [ ] Test cross-service authorization behavior.

### 9.4 End-to-end test
- [ ] Automate registration → login → household → meter → reading → history.
- [ ] Run E2E test against Docker Compose environment.

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
