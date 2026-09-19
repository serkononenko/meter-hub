# MeterHub — Architecture Overview

MVP scope: **sign in → create a household → add a meter → enter a reading →
view reading history.**

MeterHub is a small polyglot microservice platform for managing household
utility meters and their readings. It is intentionally built to experiment
with distributed systems concerns — service boundaries, API contracts,
authentication, observability — at a scale where every part stays readable.

## The moving parts

```text
  ┌──────────────┐
  │  Next.js Web │  (port 3000) — BFF routes under /api/auth/* hold tokens
  └──────┬───────┘
         │
         ▼
  ┌──────────────────┐   JWT (RS256) verification, CORS, correlation ID,
  │   API Gateway    │   access logging, metrics. Pure routing — no
  │  (Spring Cloud,  │   business logic.
  │     port 8080)   │
  └──────┬───────────┘
         │ strips /api/<service-name> and forwards
         ├────────────────────┬────────────────────┬───────────────────┐
         ▼                    ▼                    ▼                   ▼
  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │  Identity    │    │  Household   │    │    Meter     │    │   Reading    │
  │   Service    │    │   Service    │    │   Service    │    │   Service    │
  │ Spring Boot  │    │ Spring Boot  │    │    NestJS    │    │    NestJS    │
  │   (8081)     │    │   (8082)     │    │    (8083)    │    │    (8084)    │
  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
         ▼                   ▼                   ▼                   ▼
   identity_db         household_db         meter_db           reading_db
                        (PostgreSQL 17, one shared container, four databases)
```

Details:

- **Stack split** — Java 25 / Spring Boot 4 for identity, household and the
  gateway; Node 25 / NestJS 12 for meter and reading. Both stacks follow the
  same API conventions (docs/api-conventions.md), so the client never sees
  the difference.
- **Data layer** — jOOQ + Flyway on the Spring side, Prisma on the NestJS
  side. Each service owns exactly one database; migrations run automatically
  on container start.
- **Contracts** — a shared root OpenAPI document
  (contracts/openapi/openapi.yaml) plus one per-service contract under
  contracts/openapi/services/. Spring services generate API interfaces and
  problem models from the contracts at build time; the frontend generates a
  typed client with Orval.

## Authentication

Identity Service is the only token producer; everything else only verifies.

1. `POST /api/identity-service/api/v1/auth/login` returns a short-lived
   RS256 **access token** (15 min) and a rotating **refresh token** (30 days,
   single use — reuse revokes the session).
2. The web client stores tokens in Next.js BFF-only state; the browser
   never touches them directly.
3. Every API call carries `Authorization: Bearer <access token>`. The
   gateway verifies signature, issuer, audience and expiry and rejects bad
   tokens with a 401 problem before routing; each service verifies again
   (defense in depth) using the same public key.
4. The two JWT contract values (issuer `identity-service`, audience
   `meterhub-api`) are defined once in docker-compose.yml so producer and
   consumers cannot drift.

## Cross-service trust and authorization

There is no service-to-service auth token in the MVP; services trust
requests arriving on the internal Docker network. Ownership enforcement is
deliberately not centralized:

- **Meter Service** owns meters but checks against **Household Service**
  (HTTP call, correlation ID forwarded) that the caller is a member of the
  household the meter belongs to.
- **Reading Service** owns readings but checks against **Meter Service**
  that the caller may see the meter — Meter Service applies its own masking
  and answers 503 `HOUSEHOLD_SERVICE_UNAVAILABLE` when the household check
  itself is unreachable (fail closed).

See docs/service-boundaries.md for the full per-service responsibility and
boundary table.

## Observability

- **Correlation IDs** (conventions §9, api-conventions §4): every request
  gets an `X-Correlation-ID` (generated at the gateway or accepted from the
  client), echoed on responses and stamped into every log line at every hop.
- **Logging** (conventions §14): single-line JSON on stdout — timestamp,
  level, service, requestId, message. `docker compose logs` is the log
  console; a request can be followed end to end by its correlation ID.
- **Health probes** (conventions §13): `/actuator/health/liveness|readiness`
  (Spring), `/health/live|/health/ready` (NestJS). Readiness includes the
  database; liveness never touches dependencies.
- **Metrics** (task 10.4): Prometheus format at `/actuator/prometheus`
  (Micrometer, Spring services) and `/metrics` (prom-client, NestJS
  services) — HTTP request count, latency and error counts plus JVM/Node
  process metrics. No Prometheus server is deployed in the MVP; any scraper
  pointed at the services works.

## Environments

| | Local (Docker Compose) | Production intent |
|---|---|---|
| Entry point | gateway on `localhost:8080` | same services behind a real ingress |
| Database | shared PostgreSQL container, four DBs | one PostgreSQL per service (or managed equivalent) |
| JWT keys | dev key pair in git-ignored `certs/` | secret manager, mounted at `/run/secrets/` |
| Configuration | `.env` + in-repo defaults | environment variables only |
| Scaling | one container per service | each service scales independently behind the gateway |

Later MVP phases add Kafka domain events, a Notification Service
(reminders), a Provider Service, a Device Service and full observability
infrastructure — see the roadmap in README.md.
