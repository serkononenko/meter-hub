# Distributed Tracing — Task Breakdown

Spec: [2_distributed_tracing_spec.md](../spec/2_distributed_tracing_spec.md)
(parent PRD §12, companion to the metrics spec).

## Epic T1 — Collector & Compose

### T1.1 Jaeger in Compose
- [x] Add `jaeger` service (`jaegertracing/all-in-one`) on the `meter-hub` network.
- [x] Publish UI host port 16686; keep OTLP (4317/4318) internal.
- [x] Document ephemeral (in-memory) storage tradeoff in the spec.

`jaegertracing/all-in-one:1.76.0` with `COLLECTOR_OTLP_ENABLED=true`
(OTLP HTTP 4318 reachable only on the Compose network; UI published on
16686). No volume — in-memory storage, traces are ephemeral debug data.
Verified: compose config valid, UI answers 200, query API responds.

## Epic T2 — Spring instrumentation (gateway, identity, household)

### T2.1 Dependencies
- [x] Add `micrometer-tracing-bridge-otel` + OTLP exporter to the three Spring builds.
- [x] Confirm version source (Boot BOM vs explicit) and note it.

Two iterations: adding the bridge + exporter jars directly was **not**
enough — in Boot 4 the auto-configuration lives in the
`spring-boot-micrometer-tracing` module, which arrives via
`spring-boot-starter-opentelemetry` (confirmed against Boot docs).
All three builds now use that single starter; versions from the Boot BOM
(micrometer-tracing 1.7.1, OTel SDK 1.62.0).

### T2.2 Configuration
- [x] `application.yaml`: OTLP endpoint `http://jaeger:4318/v1/traces`, sampling 1.0, W3C propagation.
- [x] Keep correlation-ID behavior byte-identical (filter untouched).

Boot 4 property namespace: `management.opentelemetry.tracing.export.otlp.endpoint`
(the Boot 3-era `management.otlp.tracing.endpoint` no longer binds).
First attempt also listed `baggage` as a propagation type, which is not a
valid enum value and failed startup with a property-bind error — removed;
`w3c` only (no baggage fields are used). The endpoint is env-overridable
(`OTLP_TRACING_ENDPOINT`, set to `http://jaeger:4318/v1/traces` per
service in docker-compose.yml).

### T2.3 Verify Spring spans
- [x] Gateway + one downstream service appear as two spans in one trace.

Authenticated household creation produced a single 13-span trace
(`d58d5e29…`) spanning api-gateway → household-service: gateway server
span, security filterchain/authenticate children, client `http post`,
then household's server span `POST /api/v1/households` with its own
security children — W3C propagation works through the proxy hop.

## Epic T3 — NestJS instrumentation (meter, reading)

### T3.1 Tracing bootstrap
- [x] Add `tracing.ts` (sdk-node + auto-instrumentations + OTLP exporter), imported first in `main.ts`.
- [x] Resource: `service.name`, `service.version`.
- [x] Add Prisma instrumentation (`@prisma/instrumentation`) — with spec §FR-3 fallback if unstable.

`src/tracing.ts` in both NestJS services: `@opentelemetry/sdk-node` +
`getNodeAutoInstrumentations` + `OTLPTraceExporter` (proto) +
`PrismaInstrumentation`, endpoint/`service.name` from env
(`OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`).
`service.version` left default — the services have no meaningful version
identifier yet. Two gotchas fixed along the way: the bootstrap import
must be the **first** import in `main.ts` (the HTTP instrumentation
patches modules at load time — it briefly ended up after other imports
and had to be moved back), and the OTel JS API is
`trace.getSpan(context.active())` — `trace.context.active()` is
undefined and broke 5 reading-service tests until corrected (all 47
pass again, meter 33 pass). `/metrics` is excluded from incoming HTTP
spans so Prometheus scrapes don't pollute traces.

### T3.2 Outbound propagation
- [x] Verify reading-service's meter ownership check gets a client span with `traceparent` injected (via fetch auto-instrumentation, no generated-code changes).

Confirmed in the Jaeger UI: the ownership-check trace shows
reading-service's `GET /api/v1/meters/:id` client span (undici
auto-instrumentation) carrying the trace into meter-service's server
span — no changes to the generated client code.

### T3.3 Verify NestJS spans
- [x] Meter/reading server spans + DB spans visible in Jaeger.

`pg.query` spans incl. `INSERT reading_db` visible under the reading
server span; Prisma engine spans present under meter-service spans.
traceId appears in both services' structured JSON logs, matching the
Jaeger trace.

## Epic T4 — End-to-end verification & docs

### T4.1 Journey trace
- [x] Run the e2e journey; one trace shows gateway → reading → meter ownership check → DB waterfall.

Verified in the Jaeger UI: trace `57d7ea77c901…` shows the full
waterfall (api-gateway → reading-service → meter-service ownership
check with Prisma/pg spans → household-service); trace `b4505e492ee7…`
shows the POST reading flow including `pg.query:INSERT reading_db`.

### T4.2 Resilience
- [x] Stop Jaeger mid-flight; services keep serving (FR-5/FR-7).

`docker compose stop jaeger` with live traffic: gateway health stayed
200, a login attempt through the gateway→identity path still returned
the expected 401, and no export-error spam in service logs. Jaeger
restarted cleanly and resumed receiving traces. (In-memory storage
means trace loss during the outage is expected and accepted per spec —
all-in-one is a dev-grade backend.)

### T4.3 Log linkage
- [x] `traceId` present in structured logs where the framework exposes it cheaply; correlation ID unchanged.

NestJS services: done — `traceId` added to the structured JSON payload
via `trace.getSpan(context.active())`, verified matching Jaeger traces,
correlation-ID middleware untouched.
Spring services: initially not added (deemed beyond the "cheaply" bar),
then done as a follow-up — it turned out to be two MDC keys per log
pattern: `traceId`/`spanId` are populated by the micrometer-tracing
bridge automatically, so the only change is
`"traceId":"%X{traceId:-}","spanId":"%X{spanId:-}"` in each service's
`logging.pattern.console`. Verified live: register → login →
households through the gateway produced log lines with populated
traceId/spanId in all three Spring services, and the logged traceIds
resolve in Jaeger to traces spanning api-gateway → the target service.
The `requestId` correlation ID is unchanged.

### T4.4 Docs
- [x] README observability section + ports table (`jaeger`, 16686).
- [x] Task 10.4 / metrics-spec cross-link; deferred-experiments list updated.
- [x] Spec status → Implemented with verification notes; suites green.

README gained a "Distributed tracing (Jaeger)" section; docs/ports.md
gained the Jaeger row (UI 16686 host-published, OTLP 4318 internal
only). Task 10.4 notes and the metrics spec's deferred list now point
at the tracing spec; the README deferred/roadmap lists no longer claim
OpenTelemetry is outstanding. Spec status flipped to Implemented.

One detour worth recording: the Spring services logged "Failed to
publish metrics to OTLP receiver" every 60s — the Boot 4
`spring-boot-starter-opentelemetry` auto-enables OTLP *metrics* export
alongside traces, and nothing consumes it (Prometheus scrapes the
actuator endpoint; Jaeger only accepts traces). The first fix,
`management.opentelemetry.metrics.export.otlp.enabled: false`, did not
bind — the registry flag lives at
`management.otlp.metrics.export.enabled` (a sibling namespace, per
`OnMetricsExportEnabledCondition`). With the correct property the
warnings are gone (0 occurrences across all three services over 2+ min
uptime) and trace export is unaffected (all 6 services still listed by
the Jaeger API).
