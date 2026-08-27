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
│   └── web/
├── infrastructure/
│   ├── docker/
│   ├── postgres/
│   ├── kafka/
│   └── observability/
├── contracts/
│   ├── openapi/
│   └── events/
├── docs/
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
- OpenTelemetry / Prometheus / Grafana / Loki (later)

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

Do not commit `.env` or credentials to Git.

The exact variables should be documented in `.env.example` and kept non-sensitive where possible.

### 3. Start infrastructure

```bash
docker compose up -d
```

Check container status:

```bash
docker compose ps
```

### 4. Start services

For local development, services may be run directly from their source directories or as Docker containers.

Spring Boot services:

```bash
./mvnw spring-boot:run
```

NestJS services:

```bash
npm install
npm run start:dev
```

Next.js:

```bash
npm install
npm run dev
```

The preferred local workflow is to run shared infrastructure in Docker and application services from the IDE for faster feedback.

### 5. Verify the platform

Gateway health check:

```bash
curl http://localhost:8080/actuator/health
```

Individual services should expose a health endpoint according to their framework and the conventions described in `docs/conventions.md`.

## Service Endpoints

The API Gateway is the primary HTTP entry point for clients.

| Service | Local Port | Purpose |
|---|---:|---|
| API Gateway | 8080 | External API entry point and routing |
| Identity Service | 8081 | Authentication and identity |
| Household Service | 8082 | Households and memberships |
| Meter Service | 8083 | Meter management |
| Reading Service | 8084 | Meter readings and history |
| Next.js Web | 3000 | Web application |

These ports are local-development defaults and may be overridden through environment variables.

## API Routing

External clients should use the Gateway instead of calling services directly:

```text
/api/auth/**        → Identity Service
/api/households/**  → Household Service
/api/meters/**      → Meter Service
/api/readings/**    → Reading Service
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

## Future Roadmap

The platform is expected to evolve in roughly this order:

1. Complete the MVP end-to-end flow.
2. Add Kafka and domain events.
3. Add Notification Service and reminders.
4. Add Provider Service and provider integrations.
5. Add Telegram notifications.
6. Add Device Service and automated meter reading.
7. Add observability with OpenTelemetry, Prometheus, Grafana, and Loki.
8. Introduce Kubernetes as a separate infrastructure exercise.

## License

This is a personal pet project. Add a license here when the repository is made public.
