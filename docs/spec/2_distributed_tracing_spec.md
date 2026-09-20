# Distributed Tracing Spec — OpenTelemetry + Jaeger

**Status:** Implemented
**Version:** 0.1
**Parent:** [0_meter_hub_mvp_prd.md](0_meter_hub_mvp_prd.md) §12 Observability Requirements; companion to [1_metrics_observability_spec.md](1_metrics_observability_spec.md)
**Tasks:** [2_distributed_tracing_tasks.md](../tasks/2_distributed_tracing_tasks.md)

## 1. Overview

Correlation IDs (conventions §9) already stitch requests across services in
logs, but they are flat: one ID, no timing, no parent/child structure, no
answer to "which hop was slow". This spec adds real distributed tracing:
every request produces a span tree — gateway → downstream service →
outbound ownership check → DB — visualized as a waterfall in Jaeger, with
the existing `X-Correlation-ID` kept as the human-facing link between a
trace and the logs.

Collector choice: **Jaeger all-in-one**. It is one container with OTLP
ingest and a UI, requires no object storage, and is the lowest-friction
way to get spans on screen locally. If the metrics stack later grows into
a full Grafana LGTM setup, swapping Jaeger for Grafana Tempo is a
collector-level change — services keep exporting OTLP regardless.

## 2. Goals

- One trace per HTTP request, covering all hops: gateway routing,
  service handling, service-to-service calls (reading → meter ownership
  check), and database queries.
- No manual span plumbing in business code — instrumentation is
  auto-activation (Spring) and auto-instrumentation (NestJS) plus a small
  bootstrap file.
- Existing contracts and behavior unchanged: correlation ID semantics,
  error responses, metric labels all stay as they are.
- Reproducible from clean checkout: collector runs in Compose; all
  configuration is files in the repo.

## 3. Non-Goals

- Log aggregation (Loki) — separate effort; trace ↔ log linkage here is
  the `traceId` in log lines + `X-Correlation-ID`, not a shared backend.
- Sampling strategy beyond the default (MVP volume: keep every trace;
  revisit if head sampling becomes noise).
- Manual business spans (e.g., "validate reading") — only if the
  auto-instrumented spans prove insufficient.
- Tracing the web app / browser (RUM) — the trace starts at the gateway.
- Kafka/span messaging — no async transport exists yet (deferred
  experiments).
- Alternative collectors (Tempo, Zipkin, vendor APMs).

## 4. Architecture

```
browser ──HTTP──▶ gateway :8080 ──▶ identity  :8081   (Spring ×3)
                                   household :8082
                                   meter     :8083   (NestJS ×2)
                                   reading   :8084 ──HTTP──▶ meter (span: ownership check)
                                        │
                                        ▼ Prisma
                                     postgres

   every service exports OTLP/HTTP ──▶ jaeger :4318  (UI :16686)
```

- W3C Trace Context (`traceparent`) propagates hop to hop; the gateway
  propagates it to every downstream call, and reading-service propagates
  it into its outbound meter check.
- `X-Correlation-ID` semantics are untouched — it remains the
  request/response/log ID. The `traceId` additionally lands in log lines
  where the framework/MDC makes it cheap, so `grep traceId` joins logs
  to traces.
- Jaeger joins the `meter-hub` network; services export OTLP/HTTP to
  `http://jaeger:4318/v1/traces`. Only the Jaeger UI publishes a host
  port (16686); OTLP ingest stays internal.

## 5. Instrumentation

### 5.1 Spring services (api-gateway, identity, household)

- Dependencies: `micrometer-tracing-bridge-otel` +
  `opentelemetry-exporter-otlp-common`/`otlp` (versions managed by the
  Boot/dependency-management BOMs; micrometer-tracing 1.5.x already in
  the dependency graph's BOM).
- Spring Boot actuator auto-creates spans from server observations
  (`http.server.requests` becomes both metric and span) — zero code.
- RestClient-based outbound calls (reading-service's meter check goes
  through NestJS, not RestClient — see 5.2; the gateway's own RestClient
  usage is limited to nothing on the request path) get client spans where
  the observation registry covers them.
- Config (per service `application.yaml`):
  `management.tracing.sampling.probability: 1.0`,
  `management.otlp.tracing.endpoint: http://jaeger:4318/v1/traces`,
  propagation `tracecontext` + `baggage` alongside the existing
  correlation handling.

### 5.2 NestJS services (meter, reading)

- `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node`
  (http/express auto-spans; Prisma via `@prisma/instrumentation`) +
  OTLP HTTP trace exporter, initialized once in a `tracing.ts` imported
  first thing in `main.ts` (before any other module — required for the
  HTTP instrumentation to patch requests).
- Resource attributes: `service.name` per service, `service.version`.
- Reading-service's outbound meter check (generated fetch client,
  `meter-api.provider.ts`) is covered by the http auto-instrumentation
  because it patches global fetch — the client span + `traceparent`
  injection happen without touching generated code.

### 5.3 Collector

- `jaegertracing/all-in-one` in Compose: OTLP HTTP 4318 + UI 16686
  (host-published), in-memory storage with a size cap (all-in-one
  default), no volume — traces are ephemeral debug data.

## 6. Functional Requirements

- FR-1: Every gateway-routed request yields one trace containing the
  gateway span and the downstream service span(s).
- FR-2: Reading-service traces include a client span for the meter
  ownership check, parented under the inbound server span.
- FR-3: DB activity appears as child spans (JDBC/Hikari on Spring side;
  Prisma query spans on NestJS side where the instrumentation supports
  it — if Prisma spans require extra wiring beyond
  `@prisma/instrumentation`, they are explicitly listed as a known
  limitation rather than silently absent).
- FR-4: W3C `traceparent` propagates: gateway → service, reading →
  meter. A request started outside (curl/browser) begins a new trace at
  the gateway; a client-supplied valid `traceparent` is honored.
- FR-5: OTLP export failures never fail a request (exporter is
  fire-and-forget with batching; service runs fine with Jaeger stopped).
- FR-6: Correlation IDs keep their current semantics (format, header
  echo, log field); where cheap, log lines also carry the OpenTelemetry
  trace ID.
- FR-7: Services start with Jaeger absent (Compose profile ordering,
  `depends_on` not required for tracing — export retries/batches).

## 7. Acceptance Criteria

- [x] `docker compose up -d jaeger` + rest of stack; UI reachable at
  http://localhost:16686 without configuration.
- [x] Register→login→household→meter→reading journey produces a trace
  whose waterfall shows: gateway span → reading span → meter client span
  (ownership check) → Prisma spans.
- [x] The trace's `traceId` appears in the structured log lines of the
  involved services, joinable with `X-Correlation-ID`.
- [x] Stop Jaeger; all services keep serving requests (health green,
  journey passes) — export errors are swallowed.
- [x] Full test suites still pass; no behavioral change to API responses.
- [x] Docs updated (README metrics/observability section, ports table,
  task-list cross-links, spec status → Implemented).

## 8. Risks / Notes

- **Boot 4.1 + micrometer-tracing BOM alignment** — versions come from
  dependency-management; if the Boot BOM doesn't pin
  `opentelemetry-exporter-otlp`, the version is declared explicitly next
  to the dependency.
- **NestJS ESM + sdk-node** — the services are ESM ("type": "module");
  sdk-node is CJS-friendly via dynamic import; the bootstrap uses
  `import` order discipline instead of hooks.
- **Span volume** — all-in-one memory storage caps out; acceptable for
  local debugging (oldest traces evicted). Volume reduction = future
  sampling config, not architecture.
- **Prisma instrumentation** — `@prisma/instrumentation` is preview; if
  unstable in practice, FR-3's fallback clause applies.

## 9. Verification Notes (2026-09-20)

- End-to-end waterfall confirmed in the Jaeger UI: one trace covers
  api-gateway → reading-service → meter-service (ownership check with
  Prisma/pg spans) → household-service; a second covers the POST
  reading flow incl. `pg.query:INSERT reading_db`.
- `traceId` present in both NestJS services' structured JSON logs and
  matching the Jaeger trace; correlation-ID handling untouched.
- Resilience: `docker compose stop jaeger` under live traffic — gateway
  health 200, gateway→identity login flow returned the expected 401,
  no error spam; Jaeger restarts and resumes receiving traces.
  In-memory storage means trace loss during the outage (accepted).
- Boot 4 gotcha recorded for posterity: the starter auto-enables OTLP
  *metrics* export; the disable flag is
  `management.otlp.metrics.export.enabled: false` (sibling namespace of
  `management.opentelemetry.*` — not
  `management.opentelemetry.metrics.export.otlp.enabled`, which does
  not bind). Verified zero "Failed to publish metrics" warnings and
  trace export unaffected.
- Log linkage on the Spring side (initially left out as beyond the
  "cheaply" bar) was added in a follow-up the same day: `traceId`/
  `spanId` MDC keys appended to each service's JSON log pattern —
  the micrometer-tracing bridge populates them automatically when a
  span is active. Verified live: log traceIds from identity- and
  household-service resolve to real Jaeger traces spanning
  api-gateway → service. All five backend services' logs are now
  joinable to traces by `traceId` alongside `X-Correlation-ID`.
- Test suites after the change: meter-service 33 unit + 16 e2e,
  reading-service 47 unit + 15 e2e — all pass.
