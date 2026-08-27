# Engineering Conventions

This document defines the naming, API, service, and local infrastructure conventions used by MeterHub.

## 1. General Naming Principles

Use names that describe the business domain rather than the implementation.

Good:

```text
reading-service
meterId
householdId
recordedAt
```

Avoid:

```text
utility-service-2
entityId
dataValue
```

Use English for code, APIs, database objects, logs, and technical documentation.

## 2. Repository and Service Names

Repositories and service directories use lowercase kebab-case.

```text
api-gateway
identity-service
household-service
meter-service
reading-service
```

The service name should describe the bounded context it owns.

Do not name a service after a technical layer such as:

```text
crud-service
rest-service
database-service
```

## 3. Java / Spring Naming

Use standard Java conventions:

- Classes: `PascalCase`
- Methods and variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Packages: lowercase, no hyphens

Example:

```java
public class MeterController {
    public MeterResponse getMeter(String meterId) {
        // ...
    }
}
```

Recommended package structure:

```text
com.meterly.meter
├── api
├── application
├── domain
└── infrastructure
```

## 4. NestJS / TypeScript Naming

Use standard TypeScript conventions:

- Classes: `PascalCase`
- Variables/functions: `camelCase`
- Interfaces/types: `PascalCase`
- Constants: `UPPER_SNAKE_CASE` for true constants
- Files: lowercase kebab-case

Example:

```text
meter.controller.ts
meter.service.ts
create-meter.dto.ts
meter.entity.ts
```

## 5. Database Naming

Use PostgreSQL `snake_case` for database objects.

Tables:

```text
users
households
household_members
meters
meter_readings
```

Columns:

```text
id
household_id
serial_number
recorded_at
created_at
updated_at
```

Foreign keys should use `<entity>_id`.

Use singular conceptual names for code models and plural snake_case names for tables.

Example:

```text
Java/TypeScript: Meter
PostgreSQL: meters
```

## 6. IDs

Use opaque IDs at service boundaries. Services must not rely on another service's database-generated numeric sequence.

Preferred examples:

```text
UUID / UUIDv7 / another globally unique identifier
```

A service should expose an ID such as:

```json
{
  "id": "018f..."
}
```

rather than exposing database implementation details.

## 7. API URL Conventions

The Gateway exposes versioned APIs:

```text
/api/v1/auth
/api/v1/households
/api/v1/meters
/api/v1/readings
```

Use plural resource names.

Good:

```text
GET  /api/v1/meters
GET  /api/v1/meters/{meterId}
POST /api/v1/meters
```

Avoid verbs in resource paths where normal HTTP semantics are sufficient.

Good:

```text
POST /api/v1/readings
```

Avoid:

```text
POST /api/v1/createReading
```

Actions that do not fit CRUD semantics may use explicit action endpoints where appropriate.

## 8. JSON Conventions

Use `camelCase` in external JSON APIs.

Example:

```json
{
  "meterId": "018f...",
  "recordedAt": "2026-08-27T08:30:00Z",
  "value": 12345.6
}
```

Use ISO-8601 timestamps in UTC.

Prefer explicit names over abbreviations:

```text
recordedAt
createdAt
updatedAt
serialNumber
```

Avoid:

```text
recTs
crt
sn
```

## 9. API Responses and Errors

Success responses should use resource-oriented DTOs rather than persistence entities.

Errors should eventually use one shared structure across services, for example:

```json
{
  "code": "METER_NOT_FOUND",
  "message": "Meter was not found",
  "requestId": "abc123"
}
```

`requestId` should allow the same request to be traced across Gateway and downstream services.

## 10. Authentication and JWT Claims

Use standard JWT claims where possible:

```text
iss  issuer
sub  subject / user ID
aud  audience
exp  expiration
iat  issued-at
```

Custom claims should be minimized and documented in the identity contract.

Example:

```json
{
  "iss": "identity-service",
  "sub": "018f...",
  "aud": "meterly-api",
  "exp": 1787820000,
  "iat": 1787816400
}
```

Services must validate issuer, audience, signature, and expiration according to the security contract.

## 11. Service Ports

Local development ports are allocated in a simple, predictable block.

| Port | Component |
|---:|---|
| 3000 | Next.js Web |
| 8080 | API Gateway |
| 8081 | Identity Service |
| 8082 | Household Service |
| 8083 | Meter Service |
| 8084 | Reading Service |
| 5432 | PostgreSQL (shared local instance, if used) |
| 9092 | Kafka (when introduced) |
| 6379 | Redis (when introduced) |
| 3001 | Grafana (when introduced) |
| 9090 | Prometheus (when introduced) |

If several PostgreSQL containers are introduced later, assign separate host ports while keeping the default PostgreSQL port `5432` inside each container network.

Example:

```text
identity-postgres:5432 → localhost:5433
household-postgres:5432 → localhost:5434
meter-postgres:5432 → localhost:5435
reading-postgres:5432 → localhost:5436
```

## 12. Environment Variables

Environment variables use uppercase `SNAKE_CASE`.

Examples:

```text
SERVER_PORT
DATABASE_URL
DATABASE_USERNAME
DATABASE_PASSWORD
JWT_ISSUER
JWT_AUDIENCE
KAFKA_BOOTSTRAP_SERVERS
```

Application-specific prefixes are encouraged when ambiguity is possible:

```text
METER_DATABASE_URL
IDENTITY_JWT_ISSUER
```

Never commit secrets or real credentials.

## 13. Health Endpoints

Every backend service should expose a health/readiness endpoint.

Recommended convention:

```text
GET /actuator/health
```

for Spring Boot and an equivalent endpoint such as:

```text
GET /health
```

for NestJS.

When deployed in containers or Kubernetes, liveness and readiness should be separate concerns.

## 14. Logging

Use structured logs where possible.

Every request should include:

```text
requestId
service
timestamp
level
message
```

Example:

```json
{
  "timestamp": "2026-08-27T08:30:00Z",
  "level": "INFO",
  "service": "reading-service",
  "requestId": "abc123",
  "message": "Reading created"
}
```

Do not log passwords, access tokens, refresh tokens, or other secrets.

## 15. Service-to-Service Communication

Use synchronous HTTP for queries and simple commands where immediate responses are required.

Use Kafka events for workflows that benefit from asynchronous processing and loose coupling.

Example future event name:

```text
meter.reading.created
```

Event names use lowercase dot-separated domain terminology.

Events should include a stable event ID and metadata needed for tracing and idempotent processing.

## 16. Database Ownership Rule

A service owns its database and is the only service allowed to write to it.

Forbidden:

```text
Reading Service → SELECT from meter-db
```

Preferred:

```text
Reading Service → Meter Service API
```

or, where appropriate:

```text
Meter Service → Kafka → Reading Service
```

## 17. Commit Convention

Use Conventional Commits.

Examples:

```text
feat(meter): add meter creation endpoint
feat(reading): add manual reading entry
fix(identity): reject expired refresh token
chore(infra): add local postgres container
docs: update local setup
```

## 18. Definition of Done for a Service

A new service should have, at minimum:

- documented responsibility and data ownership
- local startup instructions
- environment variable example
- health endpoint
- basic API documentation
- Dockerfile
- unit tests for core domain logic
- structured logging
- request/correlation ID support
- no direct database access from other services

## 19. Adding a New Service

When introducing a new service:

1. Define the bounded context and ownership.
2. Define the public API and/or events.
3. Assign the next available local port.
4. Add the service to Docker Compose.
5. Add its environment variables to `.env.example`.
6. Add health checks.
7. Document the service in the architecture documentation.
8. Add API/event contracts under `contracts/`.
9. Add observability hooks.

The goal is to make every service independently understandable, runnable, and deployable.
