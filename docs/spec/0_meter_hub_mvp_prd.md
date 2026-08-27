# Home Metering — MVP Product Requirements Document

**Status:** Draft
**Version:** 0.1
**Target:** Personal / pet project

## 1. Product Overview

Home Metering is a web application for managing household utility meters, recording meter readings, viewing reading history, and preparing the foundation for future automation.

The MVP focuses on the simplest useful end-to-end flow:

> User signs in → creates a household → adds meters → manually enters readings → views reading history.

The project is intentionally implemented as a small set of microservices to experiment with distributed-system patterns and infrastructure.

## 2. Goals

### Product goals

- Allow a user to manage one or more households.
- Allow a user to add utility meters to a household.
- Allow manual entry of meter readings.
- Keep historical readings for each meter.
- Provide a simple dashboard for current meters and latest readings.
- Establish a foundation for future reminders, provider integrations, Telegram notifications, and automated meter data collection.

### Technical goals

- Practice microservice boundaries and service ownership.
- Practice API contracts and service-to-service communication.
- Run the system locally with Docker Compose.
- Use PostgreSQL with data ownership per service.
- Use Spring Boot and NestJS together in a polyglot architecture.
- Introduce an API Gateway.
- Leave room for asynchronous communication with Kafka in a later phase.

## 3. Non-Goals for MVP

The following are explicitly outside the MVP:

- Automatic meter reading from cameras, ESP32, smart meters, or other devices.
- Automatic submission of readings to utility providers.
- Telegram, email, SMS, or push notifications.
- Custom provider configuration.
- Billing, invoices, or payment processing.
- OCR / computer vision.
- Advanced analytics and forecasting.
- Mobile native application.
- Kubernetes deployment.
- Full production-grade multi-region/high-availability setup.

## 4. Target User

The initial user is a household resident who wants to keep utility meter readings in one place and avoid maintaining them manually in notes or spreadsheets.

## 5. MVP User Stories

### Authentication

- As a user, I can register an account.
- As a user, I can log in and receive an access token.
- As a user, I can access protected application functionality only after authentication.

### Household management

- As a user, I can create a household.
- As a user, I can view my households.
- As a user, I can select a household to manage its meters.

### Meter management

- As a user, I can add a meter to a household.
- As a user, I can view meters belonging to a household.
- As a user, I can identify a meter by type, name/label, serial number, and unit.
- As a user, I can disable/archive a meter without deleting its historical readings.

### Reading management

- As a user, I can manually enter a reading for a meter.
- As a user, I can specify when the reading was taken.
- As a user, I can view the reading history of a meter.
- As a user, I can see the latest reading of each active meter.
- The system records the source of an entry as `MANUAL`.

## 6. Functional Requirements

### 6.1 Identity Service

Responsibilities:

- User registration.
- Login.
- Password hashing and verification.
- Access token issuance.
- Refresh token support.
- Basic user identity management.

Minimum API:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /users/me`

The service owns user identity and authentication data.

### 6.2 Household Service

Responsibilities:

- Household creation and retrieval.
- Household membership ownership for the MVP.

Minimum API:

- `POST /households`
- `GET /households`
- `GET /households/{householdId}`

MVP assumption: the authenticated user is the owner of households they create. More advanced membership roles can be introduced later.

### 6.3 Meter Service

Responsibilities:

- Meter creation.
- Meter retrieval.
- Meter lifecycle/status.
- Association of a meter with a household.

Suggested meter fields:

- `id`
- `householdId`
- `type`
- `name`
- `serialNumber`
- `unit`
- `status`
- `createdAt`
- `updatedAt`

Initial meter types may include:

- `ELECTRICITY`
- `GAS`
- `COLD_WATER`
- `HOT_WATER`

Minimum API:

- `POST /meters`
- `GET /meters?householdId={id}`
- `GET /meters/{meterId}`
- `PATCH /meters/{meterId}`

### 6.4 Reading Service

Responsibilities:

- Store meter readings.
- Validate basic reading data.
- Return latest reading.
- Return reading history.

Suggested reading fields:

- `id`
- `meterId`
- `value`
- `recordedAt`
- `source`
- `createdAt`

Initial sources:

- `MANUAL`

Minimum API:

- `POST /readings`
- `GET /meters/{meterId}/readings`
- `GET /meters/{meterId}/readings/latest`

The Reading Service owns readings and must not directly access the Meter Service database.

## 7. Core Business Rules

### Reading validation

- Reading value must be non-negative unless a future meter type explicitly supports signed values.
- `recordedAt` is required.
- The referenced meter must exist and be accessible to the current user.
- A new reading should normally not be lower than the previous reading for cumulative meters.
- The validation should return a clear business error when a reading is invalid.

The exact handling of corrections is intentionally deferred. MVP should preserve historical records rather than silently overwriting them.

### Ownership and authorization

The system must prevent a user from accessing or modifying another user's household, meter, or reading data.

Authorization is split into two levels:

- Gateway/service security establishes the authenticated identity.
- The owning domain service performs resource-level authorization.

## 8. Architecture

### Logical architecture

```text
                         Next.js
                            |
                            v
                  Spring Cloud Gateway
                            |
          +-----------------+-----------------+
          |                 |                 |
          v                 v                 v
   Identity Service   Household Service   Meter Service
       Spring              Spring             NestJS
                                                |
                                                v
                                         Reading Service
                                             NestJS
```

### Data ownership

```text
Identity Service   -> users / credentials / refresh tokens
Household Service  -> households / memberships
Meter Service      -> meters
Reading Service    -> readings
```

Each service owns its data. No service may read another service's database directly.

### Databases

PostgreSQL is the default database technology.

For the local MVP, a single PostgreSQL instance with separate databases/schemas is acceptable, provided that logical ownership boundaries are respected. The architecture should allow migration to a separate database instance per service later.

### Communication

MVP:

- Client → Gateway: HTTP/JSON
- Gateway → services: HTTP/JSON
- Service-to-service calls: HTTP/JSON where required

Future:

- Kafka for domain events and asynchronous workflows.

## 9. API and Contract Requirements

- All public APIs must use versionable paths, e.g. `/api/v1/...`, unless there is a strong reason to keep authentication endpoints separate.
- APIs must have OpenAPI specifications.
- Error responses should follow one consistent structure across services.
- Every request should carry a correlation/request ID.
- Timestamps should use UTC and ISO-8601 representation at API boundaries.
- IDs should be opaque identifiers, preferably UUIDs.
- Contracts between services must not depend on another service's database schema.

Suggested common error shape:

```json
{
  "code": "METER_NOT_FOUND",
  "message": "Meter was not found",
  "requestId": "..."
}
```

## 10. Security Requirements

- Passwords must never be stored in plain text.
- Password hashing must use a strong adaptive password hashing algorithm supported by the selected security stack.
- JWTs must be signed and validated using a public/private key approach where practical.
- Access tokens must have a finite lifetime.
- Refresh tokens must be revocable.
- Protected APIs must validate authentication.
- Resource ownership must be enforced by the domain service.
- Secrets must not be committed to source control.

## 11. Frontend Requirements

The frontend is a Next.js application.

MVP screens:

1. Login / registration.
2. Household list.
3. Household details with meters.
4. Add/edit meter.
5. Meter details with latest reading.
6. Reading history.
7. Add reading form.

The UI should prioritize functional flows over visual polish.

## 12. Observability Requirements

Minimal MVP infrastructure should expose:

- Health/readiness endpoints for services.
- Structured application logs.
- Request/correlation ID propagation.
- Basic request/error metrics where practical.

Full Prometheus/Grafana/OpenTelemetry integration can be introduced immediately after the core flow is stable.

## 13. Infrastructure Requirements

Local development should be reproducible with Docker Compose.

Initial infrastructure:

- Next.js
- API Gateway
- Identity Service
- Household Service
- Meter Service
- Reading Service
- PostgreSQL

The setup should support one command startup and document required environment variables.

## 14. MVP Acceptance Criteria

The MVP is complete when a clean local environment can perform the following flow:

1. Start the platform with Docker Compose.
2. Register a new user.
3. Log in.
4. Create a household.
5. Add at least one electricity, gas, or water meter.
6. Enter a manual reading.
7. Retrieve the latest reading.
8. Retrieve the meter reading history.
9. Verify that another authenticated user cannot access the first user's household, meters, or readings.
10. Restart the stack without losing persisted data.

## 15. Future Roadmap

### Phase 2 — Reminders

- Reading schedules per meter/provider.
- Background scheduler.
- Reminder state and delivery tracking.

### Phase 3 — Notifications

- Telegram bot integration.
- Email notifications.
- Notification preferences.

### Phase 4 — Provider integrations

- Provider accounts.
- Provider adapter abstraction.
- Automatic submission of readings.
- Retry and failure handling.
- Custom HTTP provider configuration.

### Phase 5 — Device automation

- Device registration.
- MQTT support.
- ESP32 integration.
- Automatic reading ingestion.
- Device health and last-seen status.

### Phase 6 — Distributed-system experiments

- Kafka.
- Outbox pattern.
- Idempotent consumers.
- Retry topics / dead-letter topics.
- Distributed tracing.
- Prometheus/Grafana/Loki.
- Kubernetes.

## 16. Product Success for the Pet Project

The MVP is successful when it provides a usable manual meter-tracking application and, at the same time, creates a clean technical foundation for adding asynchronous processing, external integrations, and automated meter collection without redesigning the core domain model.
