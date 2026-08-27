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
- [ ] Create Docker Compose base file.
- [ ] Add PostgreSQL.
- [ ] Create persistent PostgreSQL volume.
- [ ] Add environment variable configuration.
- [ ] Add health checks.

### 1.2 Service networking
- [ ] Create internal Docker network.
- [ ] Define stable service DNS names.
- [ ] Document external vs internal ports.

### 1.3 Database initialization
- [ ] Create Identity database/schema.
- [ ] Create Household database/schema.
- [ ] Create Meter database/schema.
- [ ] Create Reading database/schema.
- [ ] Ensure each service only uses its own database/schema credentials.

---

## Epic 2 — Identity Service — Spring Boot

### 2.1 Bootstrap service
- [ ] Create Spring Boot project.
- [ ] Add Spring Web.
- [ ] Add Spring Security.
- [ ] Add persistence dependencies.
- [ ] Configure PostgreSQL.
- [ ] Add Flyway or Liquibase migrations.

### 2.2 User model
- [ ] Create User entity.
- [ ] Add unique email/username constraint.
- [ ] Add account status.
- [ ] Add created/updated timestamps.

### 2.3 Registration
- [ ] Implement `POST /api/v1/auth/register`.
- [ ] Validate input.
- [ ] Hash password.
- [ ] Persist user.
- [ ] Handle duplicate identity errors.

### 2.4 Login
- [ ] Implement `POST /api/v1/auth/login`.
- [ ] Validate credentials.
- [ ] Generate access token.
- [ ] Return token metadata.

### 2.5 Refresh tokens
- [ ] Create refresh token model.
- [ ] Implement refresh token rotation or revocation strategy.
- [ ] Implement `POST /api/v1/auth/refresh`.
- [ ] Implement `POST /api/v1/auth/logout`.

### 2.6 Current user
- [ ] Implement `GET /api/v1/users/me`.
- [ ] Return stable user identity information.

### 2.7 Security tests
- [ ] Test password hashing.
- [ ] Test invalid login.
- [ ] Test expired/invalid token.
- [ ] Test refresh token revocation.

---

## Epic 3 — API Gateway — Spring Cloud Gateway

### 3.1 Bootstrap gateway
- [ ] Create Spring Cloud Gateway project.
- [ ] Configure service routes.
- [ ] Add Docker image.

### 3.2 Routing
- [ ] Route `/api/v1/auth/**` to Identity Service.
- [ ] Route `/api/v1/users/**` to Identity Service.
- [ ] Route `/api/v1/households/**` to Household Service.
- [ ] Route `/api/v1/meters/**` to Meter Service.
- [ ] Route `/api/v1/readings/**` to Reading Service.

### 3.3 Authentication
- [ ] Configure JWT validation at the gateway.
- [ ] Allow public access to registration/login/refresh endpoints.
- [ ] Require authentication for protected routes.
- [ ] Propagate authenticated identity where required.

### 3.4 Cross-cutting concerns
- [ ] Generate or propagate request/correlation ID.
- [ ] Add access logging.
- [ ] Configure CORS.
- [ ] Configure request timeouts.
- [ ] Add basic rate limiting design; implementation may be deferred.

---

## Epic 4 — Household Service — Spring Boot

### 4.1 Bootstrap service
- [ ] Create Spring Boot project.
- [ ] Configure PostgreSQL.
- [ ] Configure migration tool.
- [ ] Add service health endpoint.

### 4.2 Household model
- [ ] Create Household entity.
- [ ] Create household owner/membership model.
- [ ] Add created/updated timestamps.

### 4.3 APIs
- [ ] Implement `POST /api/v1/households`.
- [ ] Implement `GET /api/v1/households`.
- [ ] Implement `GET /api/v1/households/{householdId}`.

### 4.4 Authorization
- [ ] Extract user identity from JWT/security context.
- [ ] Restrict household queries to the authenticated user.
- [ ] Add unauthorized access tests.

---

## Epic 5 — Meter Service — NestJS

### 5.1 Bootstrap service
- [ ] Create NestJS project.
- [ ] Configure PostgreSQL.
- [ ] Select and configure ORM/query library.
- [ ] Configure database migrations.
- [ ] Add health endpoint.

### 5.2 Meter model
- [ ] Create Meter entity/model.
- [ ] Add household ID.
- [ ] Add meter type.
- [ ] Add name/label.
- [ ] Add serial number.
- [ ] Add unit.
- [ ] Add status.
- [ ] Add timestamps.

### 5.3 APIs
- [ ] Implement `POST /api/v1/meters`.
- [ ] Implement `GET /api/v1/meters` by household.
- [ ] Implement `GET /api/v1/meters/{meterId}`.
- [ ] Implement `PATCH /api/v1/meters/{meterId}`.

### 5.4 Authorization
- [ ] Validate JWT or propagated authentication context.
- [ ] Verify that the current user owns the referenced household.
- [ ] Prevent access to another user's meter.

### 5.5 Validation
- [ ] Validate supported meter types.
- [ ] Validate required fields.
- [ ] Define serial number uniqueness policy.

---

## Epic 6 — Reading Service — NestJS

### 6.1 Bootstrap service
- [ ] Create NestJS project.
- [ ] Configure PostgreSQL.
- [ ] Configure database migrations.
- [ ] Add health endpoint.

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
