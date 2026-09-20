# MeterHub

MeterHub is a pet project for managing household utility meters and their readings.

The initial MVP supports the following flow:

> Sign in → create a household → add a meter → enter a reading → view reading history

The project is intentionally built as a small polyglot microservice platform to experiment with distributed systems, service boundaries, API contracts, authentication, observability, and infrastructure.

## Architecture

```text
                         ┌──────────────┐
                         │    Next.js   │
                         │   Web App    │
                         └──────┬───────┘
                                │ HTTPS
                                ▼
                      ┌────────────────────┐
                      │ Spring Cloud       │
                      │ API Gateway        │
                      └─────────┬──────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
       Identity Service   Household Service   Meter Service
          Spring Boot        Spring Boot         NestJS
              │                 │                 │
              ▼                 ▼                 ▼
        identity-db       household-db        meter-db

                                │
                                ▼
                         Reading Service
                             NestJS
                                │
                                ▼
                           reading-db
```

Later iterations may introduce Kafka, Notification Service, Provider Service, Device Service, Redis, and observability infrastructure.

## Repository Structure

```text
meter-hub/
├── services/
│   ├── api-gateway/
│   ├── identity-service/
│   ├── household-service/
│   ├── meter-service/
│   └── reading-service/
├── frontend/
├── infrastructure/
│   └── postgres/          # init script creating the four databases
├── contracts/
│   ├── openapi/           # root + per-service OpenAPI contracts
│   └── events/
├── e2e/
│   └── journey.e2e.test.mjs
├── docs/                  # conventions, port plan, task checklist
└── docker-compose.yml
```

## Technology Stack

### Frontend

- Next.js
- React
- TypeScript

### Backend

- Java / Spring Boot
- Spring Cloud Gateway
- Node.js / NestJS
- TypeScript

### Infrastructure

- Docker / Docker Compose
- PostgreSQL
- Kafka (later MVP phase)
- Redis (later)
- Log-based alerting (logs are in Loki; alert rules on them are not set up)

## Local Development Prerequisites

Install the following tools:

- Docker Desktop or Docker Engine + Docker Compose
- Git
- JDK 21+ for Spring services
- Node.js 22+ for NestJS and Next.js services
- npm, pnpm, or the package manager selected by the repository

The project should be runnable with Docker Compose once the services and images are configured.

## Local Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd meter-hub
```

### 2. Configure environment variables

Create the local environment file from the example:

```bash
cp .env.example .env
```

Then fill in the `...` password placeholders (any values work locally).
See [Environment Variables](#environment-variables) below for the full list
and where each one is read. Do not commit `.env` or credentials to Git.

### 3. Generate the JWT signing keys (first run only)

Each service reads the token-signing key pair from a per-service `certs`
symlink pointing at the shared repo-root `certs/` directory (in Docker the
same files arrive as secret mounts instead):

```bash
mkdir -p certs
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
  -out certs/identity.jwt.private-key
openssl pkey -in certs/identity.jwt.private-key -pubout \
  -out certs/identity.jwt.public-key
for s in api-gateway identity-service household-service meter-service reading-service; do
  ln -sfn ../../certs services/$s/certs
done
```

`certs/` is git-ignored — never commit the keys.

### 4. Start the stack (one command)

```bash
docker compose up -d --build
```

That single command brings up everything: PostgreSQL (with the four
databases and users created by `infrastructure/postgres/init/`), all five
services, and the web application — and it applies database migrations
automatically (Flyway for the Spring services, `prisma migrate deploy` for
the NestJS services, each on container start). The web app is then reachable
at http://localhost:3000.

Watch it come up and check container status:

```bash
docker compose logs -f
docker compose ps
```

**Alternative: hybrid mode.** The preferred day-to-day workflow is to run
shared infrastructure in Docker and application services from the IDE (or
`./gradlew bootRun` / `npm run start:dev`) for faster feedback:

```bash
docker compose up -d postgres   # only the database
# then start the services you are working on from their directories:
#   Spring:  cd services/identity-service && ./gradlew bootRun
#   NestJS:  cd services/meter-service && npm install && npm run start:dev
#   Next.js: cd frontend && npm install && npm run dev
```

Services started this way reach PostgreSQL on `localhost:5432` with the
in-repo defaults (see [Environment Variables](#environment-variables)); no
extra configuration is needed beyond `.env`-independent defaults and the
`certs/` symlinks from step 3.

### 5. Verify the platform

Gateway health check (includes the database-backed readiness group):

```bash
curl http://localhost:8080/actuator/health
```

Every service also exposes framework-standard liveness/readiness probes per
`docs/conventions.md` §13 — `/actuator/health/liveness` and
`/actuator/health/readiness` on the Spring services, `/health/live` and
`/health/ready` on the NestJS services. In Compose these are reachable only
on the services' internal ports; when running a service locally, e.g.:

```bash
curl http://localhost:8083/health/ready
```

A fuller check is the end-to-end journey test below, which exercises the
whole MVP flow through the gateway.

### Metrics (task 10.4)

Every service exposes Prometheus-format metrics: `/actuator/prometheus` on
the Spring services (Micrometer — `http_server_requests_seconds` gives
request count, latency and error counts via the `status`/`outcome` tags,
plus JVM/process metrics), `/metrics` on the NestJS services (prom-client —
`http_requests_total` + `http_request_duration_seconds`, plus Node.js
process metrics). In Compose the endpoints are reachable only on the
services' internal ports; locally:

```bash
curl http://localhost:8080/actuator/prometheus | head   # gateway
curl http://localhost:8083/metrics | head               # meter service
```

### Metrics stack (Prometheus + Grafana)

`docker compose up -d prometheus grafana` starts the observability pair:

- **Prometheus** (http://localhost:9090) scrapes all five services over the
  internal network every 15s (config: `infrastructure/prometheus/prometheus.yml`),
  7-day local retention.
- **Grafana** (http://localhost:3001, `admin`/`admin` by default — override
  with `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD` in `.env`) provisions the
  Prometheus datasource and the "MeterHub Overview" dashboard automatically
  (`infrastructure/grafana/`): request rate, p95 latency and 5xx rate per
  service (Spring and NestJS panels, since the two stacks use different metric
  names), JVM heap / Node process CPU, and scrape-target health.

### Distributed tracing (Jaeger)

All five services emit OpenTelemetry spans to Jaeger all-in-one:
W3C `traceparent` propagates across the gateway → service → service hops,
so one request shows up as a single waterfall in the Jaeger UI
(http://localhost:16686) — e.g. a reading submission traces from the
gateway through reading-service, meter-service's ownership check
(Prisma/PostgreSQL spans included) and household-service. Every backend
service also stamps `traceId`/`spanId` into its structured logs next to
the correlation ID, so log lines join to Jaeger traces by ID. Traces
are in-memory only (all-in-one is a dev-grade backend), and services
start fine with Jaeger absent — export failures never fail a request.

### Log aggregation (Loki)

Every container's stdout is scraped by Promtail (via the Docker socket)
into Loki, queryable in Grafana (Explore or the provisioned "MeterHub
Logs" dashboard). Each stream is labeled with the Compose `service`
name; find one request across all services by pasting its ID as a line
filter: `{service=~".+"} |= "<traceId>"` (or the `X-Correlation-ID`
`requestId`). IDs are deliberately line filters, not labels — high
cardinality labels would wreck Loki's index (spec 3 §6). With Loki
down, services keep logging locally; Promtail buffers and retries.

### CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push to `main` and every PR:
the three Spring suites (`./gradlew test`, JDK 25) and two NestJS
suites (`npm test`, Node 22) as matrix jobs, then — only if those pass —
a full e2e job that generates throwaway JWT keys and `.env` secrets,
starts the whole platform with `docker compose up -d --build`, waits for
each service's readiness endpoint (not just the gateway's), and drives
`e2e/journey.e2e.test.mjs` against the real gateway. Nothing is mocked
and no images are published. The integration tests run against a
postgres:17 service container seeded like the local Compose database.

First fully green run: 2026-09-20
(https://github.com/serkononenko/meter-hub/actions/runs/35507815666).

A second workflow (`publish.yml`) runs on every green `main` push:
it builds the six images (five services + web) and publishes them to
`ghcr.io` (`linux/amd64`, tagged `main`/`latest`/SHA), so deployment
targets pull instead of building on-device — see
[docs/deploy-portainer.md](docs/deploy-portainer.md).

### 6. Run the end-to-end journey test

Drives the full MVP flow through the gateway against the running Compose
environment — registration → login → household → meter → reading → history,
plus refresh-token rotation, logout, and cross-user isolation:

```bash
node --test e2e/journey.e2e.test.mjs
```

Requires the Compose stack (or equivalent local services) to be up; override
the gateway address with `GATEWAY_URL` if it is not on `http://localhost:8080`.
Each run uses unique test accounts, so it is safe to re-run against a
persistent database.

### 7. Reset the development database (one command)

Wipes the PostgreSQL volume (all four databases, all data) and recreates it
from the init script; the next `up` re-runs every migration from scratch:

```bash
docker compose down -v && docker compose up -d --build
```

Use this when migrations change, seed data is stale, or the platform is in
an unknown state. It destroys all local data — there is no undo.

## Service Endpoints

The API Gateway is the primary HTTP entry point for clients.

| Service | Local Port | Exposed by Compose | Purpose |
|---|---:|---|---|
| API Gateway | 8080 | yes (`8080:8080`) | External API entry point and routing |
| Identity Service | 8081 | no (internal) | Authentication and identity |
| Household Service | 8082 | no (internal) | Households and memberships |
| Meter Service | 8083 | no (internal) | Meter management |
| Reading Service | 8084 | no (internal) | Meter readings and history |
| Next.js Web | 3000 | yes (`3000:3000`) | Web application |
| PostgreSQL | 5432 | yes (`5432:5432`) | Shared local database instance |

These ports are local-development defaults and may be overridden through
environment variables (`SERVER_PORT`, `POSTGRES` port mapping). In Compose,
only the gateway, PostgreSQL, and (when run locally) the web app are
reachable from the host — services talk to each other over the internal
`meter-hub` Docker network, so clients must go through the gateway.

## Environment Variables

All service configuration has in-repo defaults for local development;
`.env` exists to override them (mainly the database credentials, which
Compose injects into both PostgreSQL and the services so they always agree).

### Compose / all services (`.env` at repo root)

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | postgres container | — (required) | Superuser account of the shared PostgreSQL instance |
| `IDENTITY_DB` / `IDENTITY_DB_USER` / `IDENTITY_DB_PASSWORD` | identity-service, postgres init | — (required) | Database name and owner for the Identity Service |
| `HOUSEHOLD_DB` / `HOUSEHOLD_DB_USER` / `HOUSEHOLD_DB_PASSWORD` | household-service, postgres init | — (required) | Database name and owner for the Household Service |
| `METER_DB` / `METER_DB_USER` / `METER_DB_PASSWORD` | meter-service, postgres init | — (required) | Database name and owner for the Meter Service |
| `READING_DB` / `READING_DB_USER` / `READING_DB_PASSWORD` | reading-service, postgres init | — (required) | Database name and owner for the Reading Service |
| `IDENTITY_JWT_ISSUER` | identity-service, api-gateway, meter/reading | `identity-service` | JWT `iss` claim — must match between signer and validators |
| `IDENTITY_JWT_AUDIENCE` | identity-service, api-gateway, meter/reading | `meterhub-api` | JWT `aud` claim — must match between signer and validators |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | grafana container | `admin` / `admin` | Grafana admin login (local-only default; change before any shared environment) |

### Per-service (only when overriding in-repo defaults)

| Variable | Service | Default | Purpose |
|---|---|---|---|
| `SERVER_PORT` | all backend services | `8080`–`8084` (per service) | HTTP listen port |
| `DB_HOST` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` | identity, household | `localhost` / per-service db | PostgreSQL connection (JDBC) |
| `DATABASE_URL` | meter, reading | `postgresql://<user>@localhost:5432/<db>` | PostgreSQL connection URL (Prisma) |
| `IDENTITY_JWT_PUBLIC_KEY_PATH` | meter, reading | `./certs/identity.jwt.public-key` | Where the public key PEM lives (Spring services read it via the `certs/` configtree instead) |
| `IDENTITY_JWT_ACCESS_TOKEN_TTL` | identity-service | `15m` | Access-token lifetime |
| `IDENTITY_JWT_REFRESH_TOKEN_TTL` | identity-service | `30d` | Refresh-token lifetime |
| `IDENTITY_SERVICE_URL` | api-gateway | `http://localhost:8081` | Downstream target for `/api/identity-service/**` |
| `HOUSEHOLD_SERVICE_URL` | api-gateway, meter | `http://localhost:8082` | Downstream routing target / meter ownership checks |
| `METER_SERVICE_URL` | api-gateway, reading | `http://localhost:8083` | Downstream routing target / reading ownership checks |
| `READING_SERVICE_URL` | api-gateway | `http://localhost:8084` | Downstream target for `/api/reading-service/**` |
| `CORS_ALLOWED_ORIGINS` | api-gateway | `http://localhost:3000,http://127.0.0.1:3000` | Browser origins allowed to call the gateway |
| `LOG_LEVEL` | meter, reading | `info` | Structured-log threshold (`fatal`/`error`/`warn`/`info`/`debug`) |

### Frontend (`frontend/.env.local`, from `frontend/.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `GATEWAY_URL` | `http://localhost:8080` | API gateway base URL (server-side only — the browser talks to Next.js BFF routes) |

The JWT signing keys are deliberately **not** environment variables — each
environment delivers the two PEM files (`identity.jwt.private-key` /
`identity.jwt.public-key`) as files: locally via the per-service `certs/`
symlinks, in Compose as secret mounts at `/run/secrets/`.

## API Routing

External clients should use the Gateway instead of calling services directly:

```text
/api/identity-service/**   → Identity Service
/api/household-service/**  → Household Service
/api/meter-service/**      → Meter Service
/api/reading-service/**    → Reading Service
```

Direct service ports are intended for local development, debugging, and health checks.

## MVP Flow

The first end-to-end scenario is:

1. Register or sign in.
2. Create a household.
3. Add a utility meter to the household.
4. Enter a meter reading.
5. Retrieve the reading history.
6. Display the meter and latest reading in the web application.

## Data Ownership

Each service owns its data and database schema. Services must not access another service's database directly.

| Service | Owns |
|---|---|
| Identity Service | Users, credentials, authentication data |
| Household Service | Households, household members |
| Meter Service | Meters and meter metadata |
| Reading Service | Meter readings |

Cross-service data must be accessed through APIs or asynchronous events.

## Development Principles

- Keep domain logic inside the owning service.
- Keep the API Gateway free of business logic.
- Prefer stable, versioned API contracts.
- Do not share database tables between services.
- Use explicit IDs across service boundaries rather than leaking persistence models.
- Make asynchronous consumers idempotent when Kafka is introduced.
- Add correlation/request IDs to requests and logs.
- Keep secrets out of source control.

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture-overview.md](docs/architecture-overview.md) | Architecture overview: components, authentication flow, cross-service trust, observability, environments |
| [docs/api-examples.md](docs/api-examples.md) | API usage examples: the full MVP flow with runnable curl requests and error codes |
| [docs/service-boundaries.md](docs/service-boundaries.md) | Service boundaries: per-service responsibilities, owned data, APIs and cross-service rules |
| [docs/api-conventions.md](docs/api-conventions.md) | API conventions: versioning, IDs, timestamps, correlation ID, RFC 9457 problem responses |
| [docs/conventions.md](docs/conventions.md) | Engineering conventions: naming, ports, env vars, health, logging, DB ownership, commit style |
| [docs/ports.md](docs/ports.md) | Local service port plan |
| [docs/known-limitations.md](docs/known-limitations.md) | Known limitations: deliberate scope cuts and simplifications in the MVP |
| [docs/spec/1_metrics_observability_spec.md](docs/spec/1_metrics_observability_spec.md) | Metrics observability spec: Prometheus scraping, Grafana provisioning, dashboard contract, deferred work |
| [docs/tasks/1_metrics_observability_tasks.md](docs/tasks/1_metrics_observability_tasks.md) | Metrics observability task breakdown (M1–M3) with verification notes |
| [docs/spec/2_distributed_tracing_spec.md](docs/spec/2_distributed_tracing_spec.md) | Distributed tracing spec: Jaeger all-in-one, W3C propagation, per-stack instrumentation, deferred work |
| [docs/tasks/2_distributed_tracing_tasks.md](docs/tasks/2_distributed_tracing_tasks.md) | Distributed tracing task breakdown (T1–T4) with verification notes |
| [docs/spec/3_log_aggregation_spec.md](docs/spec/3_log_aggregation_spec.md) | Log aggregation spec: Loki + Promtail, service labels, ID line-filter search, deferred work |
| [docs/tasks/3_log_aggregation_tasks.md](docs/tasks/3_log_aggregation_tasks.md) | Log aggregation task breakdown (L1–L3) with verification notes |
| [docs/deploy-portainer.md](docs/deploy-portainer.md) | Portainer deployment guide: pull-based deploys, registry credentials, ports, updates |
| [contracts/openapi/openapi.yaml](contracts/openapi/openapi.yaml) | Root OpenAPI contract; per-service contracts under `contracts/openapi/services/` |

## Future Roadmap

The platform is expected to evolve in roughly this order:

1. Complete the MVP end-to-end flow.
2. Add Kafka and domain events.
3. Add Notification Service and reminders.
4. Add Provider Service and provider integrations.
5. Add Telegram notifications.
6. Add Device Service and automated meter reading.
7. Add observability: log-based alerting to complete the Loki stack (Prometheus/Grafana/Jaeger/Loki are in place).
8. Introduce Kubernetes as a separate infrastructure exercise.

## License

This is a personal pet project. Add a license here when the repository is made public.
