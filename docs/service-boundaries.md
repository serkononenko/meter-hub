# MeterHub — Service Boundaries

## Overview

MeterHub is designed as a polyglot microservice application for managing household utility meters, collecting readings, sending reminders, and eventually integrating with automatic meter-reading devices and utility providers.

The MVP consists of five backend components:

- API Gateway
- Identity Service
- Household Service
- Meter Service
- Reading Service

The following services are planned for later iterations:

- Notification Service
- Provider Service
- Device Service

## High-Level Architecture

```text
                           ┌──────────────┐
                           │   Next.js    │
                           │   Web App    │
                           └──────┬───────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  API Gateway    │
                         │ Spring Gateway  │
                         └────────┬────────┘
                                  │
          ┌───────────────┬───────┼───────────────┬──────────────┐
          ▼               ▼       ▼               ▼              ▼
     Identity        Household   Meter          Reading       Notification
      Service         Service   Service         Service         Service
          │               │       │               │              │
          ▼               ▼       ▼               ▼              ▼
      identity-db    household-db meter-db     reading-db   notification-db
```

For the MVP, the active architecture is:

```text
Next.js
   │
   ▼
API Gateway
   │
   ├── Identity Service
   ├── Household Service
   ├── Meter Service
   └── Reading Service
```

## Core Principles

### 1. One service owns a business capability

Services should be organized around business responsibilities rather than individual database tables or technical layers.

### 2. Each service owns its data

A service is the owner of its database/schema and is the only component allowed to modify that data.

### 3. No cross-service database access

A service must never directly access another service's database.

```text
❌ Reading Service → meter-db

✅ Reading Service → Meter Service API
✅ Meter Service → Kafka event → interested consumers
```

### 4. Use synchronous communication when an immediate response is required

REST/gRPC can be used for request/response interactions.

### 5. Use asynchronous events for facts that have already happened

Kafka will be used for domain events and asynchronous workflows.

Example:

```text
Reading Service
      │
      │ ReadingCreated
      ▼
    Kafka
      │
      ├── Notification Service
      ├── Analytics Service
      └── Provider Service
```

---

# 1. API Gateway

**Technology:** Spring Cloud Gateway

### Responsibility

The API Gateway is the single external entry point for backend APIs.

It is responsible for infrastructure-level concerns such as:

- request routing
- JWT validation
- rate limiting
- CORS
- correlation/request IDs
- access logging
- timeouts and basic resilience

### Example Routes

```text
/api/auth/**        → Identity Service
/api/users/**       → Identity Service
/api/households/**  → Household Service
/api/meters/**      → Meter Service
/api/readings/**    → Reading Service
```

### Does not own

- business data
- domain rules
- meter ownership decisions
- reading validation/business logic
- provider integrations
- notification delivery

Business authorization should remain in the service that owns the relevant business context.

### Rate limiting (design)

Rate limiting is a gateway concern; per-client limits protect the downstream
services from abusive traffic and accidental loops.

- **Scope:** all `/api/v1/**` routes at the gateway.
- **Key:** access token `sub` claim for authenticated requests; client IP for
  public requests (registration, login, refresh — these are the
  credential-stuffing/brute-force targets, so they get the tightest limits).
- **Algorithm:** token bucket per key — allows short bursts while capping the
  sustained rate. Implemented in-process at the gateway (single instance for
  the MVP); a shared store (e.g. Redis) is only needed once the gateway
  scales out.
- **Library hook:** `Bucket4jFilterFunctions.rateLimit(...)` from
  spring-cloud-gateway-server-webmvc (requires adding the `bucket4j`
  dependency).
- **Behavior on limit:** HTTP 429 with the standard problem+json body and the
  `Retry-After` header; the correlation ID filter still runs.
- **Status:** implementation deferred — design agreed here, wiring planned
  after the MVP routes are stable.

---

# 2. Identity Service

**Technology:** Spring Boot

### Responsibility

Identity Service owns user identity and authentication.

### Owned Data

```text
User
Credential
RefreshToken / Session
Role
```

### API

```http
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout

GET /users/me
```

### Does not own

- households
- household membership
- meters
- readings
- provider accounts
- Telegram integrations
- meter-specific business authorization

### Database

```text
identity-db
```

---

# 3. Household Service

**Technology:** Spring Boot

### Responsibility

Household Service manages households/properties and their members.

### Owned Data

```text
Household
HouseholdMember
```

### Example Model

```text
Household
├── id
├── name
└── address

HouseholdMember
├── householdId
├── userId
└── role
```

### Household Roles

```text
OWNER
MEMBER
VIEWER
```

### API

```http
POST   /households
GET    /households
GET    /households/{id}
PUT    /households/{id}
DELETE /households/{id}

POST   /households/{id}/members
DELETE /households/{id}/members/{userId}
```

### Boundary

Household Service owns:

- household identity
- household configuration
- household membership
- membership roles

It does not own meter details or readings.

### Database

```text
household-db
```

---

# 4. Meter Service

**Technology:** NestJS

### Responsibility

Meter Service manages physical/domain meter entities.

### Owned Data

```text
Meter
```

### Example Model

```text
Meter
├── id
├── householdId
├── type
├── serialNumber
├── unit
├── name
└── status
```

### Meter Types

```text
ELECTRICITY
GAS
COLD_WATER
HOT_WATER
```

### API

```http
POST   /meters
GET    /meters
GET    /meters/{id}
PUT    /meters/{id}
DELETE /meters/{id}
```

### Boundary

Meter Service owns:

- meter identity
- meter type
- serial number
- unit
- meter status
- relationship between a meter and a household

Meter Service does **not** store meter readings.

### Database

```text
meter-db
```

---

# 5. Reading Service

**Technology:** NestJS

### Responsibility

Reading Service manages meter readings and reading history.

### Owned Data

```text
Reading
```

### Example Model

```text
Reading
├── id
├── meterId
├── value
├── recordedAt
├── source
└── createdAt
```

### Reading Sources

```text
MANUAL
DEVICE
IMPORT
```

### API

```http
POST /readings
GET  /readings/{id}
GET  /meters/{meterId}/readings
```

### Example Request

```json
{
  "meterId": "meter-123",
  "value": 12543.7,
  "recordedAt": "2026-08-27T09:00:00Z",
  "source": "MANUAL"
}
```

### Boundary

Reading Service owns:

- reading values
- reading timestamps
- reading source
- reading history
- reading lifecycle/events

It does not own:

- meter metadata
- household membership
- provider integrations
- authentication

### Database

```text
reading-db
```

---

# 6. Notification Service — Future

**Status:** Planned, not part of MVP.

### Responsibility

Manage reminders and delivery of user notifications.

### Owned Data

```text
Reminder
Notification
NotificationChannel
```

### Channels

```text
TELEGRAM
EMAIL
PUSH
```

### Example Flow

```text
Reading deadline approaching
          │
          ▼
Notification Service
          │
     ┌────┴────┐
     ▼         ▼
 Telegram     Email
```

### Database

```text
notification-db
```

---

# 7. Provider Service — Future

**Status:** Planned, not part of MVP.

### Responsibility

Manage utility providers and integrations used to submit readings.

### Owned Data

```text
Provider
ProviderAccount
ProviderIntegration
```

### Example Architecture

```text
                   Provider Service
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
          Provider A  Provider B   Custom HTTP
```

### Important Boundary

Meter Service should not know how a reading is submitted to a specific utility provider.

Provider Service owns provider-specific integration logic.

---

# 8. Device Service — Future

**Status:** Planned, not part of MVP.

### Responsibility

Manage physical devices used to collect readings automatically.

### Owned Data

```text
Device
DeviceReading / DeviceEvent
```

### Example Model

```text
Device
├── id
├── householdId
├── meterId
├── type
├── status
└── lastSeen
```

### Example Future Flow

```text
ESP32-CAM
    │
    │ MQTT
    ▼
Device Service
    │
    │ ReadingDetected
    ▼
  Kafka
    │
    ▼
Reading Service
```

The Reading Service should remain independent of the physical device implementation.

---

# Data Ownership

| Data | Owner |
|---|---|
| User | Identity Service |
| Credentials | Identity Service |
| Roles | Identity Service |
| Household | Household Service |
| Household Membership | Household Service |
| Meter | Meter Service |
| Reading | Reading Service |
| Reminder | Notification Service |
| Notification | Notification Service |
| Provider | Provider Service |
| Provider Credentials | Provider Service |
| Device | Device Service |

---

# Cross-Service Communication

## REST / HTTP

Use synchronous APIs when the caller needs an immediate response.

Example:

```text
Frontend
   │
   ▼
API Gateway
   │
   ▼
Meter Service
   │
   └── response
```

Typical use cases:

- create a meter
- retrieve a household
- retrieve reading history
- authenticate a user

## Kafka Events

Use asynchronous events when notifying other services that something happened.

Example:

```text
Reading Service
      │
      │ ReadingCreated
      ▼
    Kafka
      │
      ├── Notification Service
      ├── Provider Service
      └── Analytics Service
```

The producer should not need to know which consumers exist.

---

# Authorization Boundary

Authentication and authorization should be separated.

### Gateway

The Gateway can perform coarse-grained checks such as:

```text
Is the JWT valid?
Is the token intended for this API?
Does the request contain the required scope/role?
```

### Domain Service

The owning service performs business-specific authorization.

Example:

```text
Gateway:
"Is this an authenticated user?"

Meter Service:
"Does this user have access to meter 456?"
```

This prevents business authorization logic from accumulating in the Gateway.

---

# Identity Propagation

Services should receive the authenticated user's identity through the security context derived from the JWT.

The JWT should contain a small, stable set of claims.

Example:

```json
{
  "iss": "https://identity.meterhub.local",
  "sub": "user-123",
  "aud": "meterhub-api",
  "iat": 1787816400,
  "exp": 1787820000,
  "scope": "meters.read meters.write"
}
```

Services should not depend on large, frequently changing JWT payloads for domain authorization.

---

# MVP Service Set

The first implementation should contain only these services:

```text
1. API Gateway
2. Identity Service
3. Household Service
4. Meter Service
5. Reading Service
```

The first end-to-end business flow should be:

```text
User registers
      ↓
User logs in
      ↓
User creates household
      ↓
User adds meter
      ↓
User enters reading
      ↓
User views reading history
```

Once this works end-to-end, introduce Kafka and the future services incrementally.

---

# Planned Evolution

```text
MVP
 │
 ├── Gateway
 ├── Identity
 ├── Household
 ├── Meter
 └── Reading
        │
        ▼
Async Architecture
 │
 ├── Kafka
 └── Notification
        │
        ▼
Provider Integration
 │
 └── Provider Service
        │
        ▼
Automatic Collection
 │
 └── Device Service
        │
        ▼
Observability / Platform
 │
 ├── OpenTelemetry
 ├── Prometheus
 ├── Grafana
 ├── Loki
 └── Kubernetes
```

# Boundary Rules Summary

1. A service owns its business data and database.
2. No service directly reads or writes another service's database.
3. Gateway contains infrastructure concerns, not business logic.
4. Identity owns authentication and user identity.
5. Household owns household membership.
6. Meter owns meters, but not readings.
7. Reading owns readings and reading history.
8. Provider owns provider-specific submission logic.
9. Device owns device-specific ingestion concerns.
10. Cross-service interactions should use APIs or events, never shared database access.
