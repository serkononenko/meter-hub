# Log Aggregation Spec — Loki + Promtail (Docker Compose)

**Status:** Implemented
**Version:** 0.1
**Parent:** [0_meter_hub_mvp_prd.md](0_meter_hub_mvp_prd.md) §Observability; companion to [1_metrics_observability_spec.md](1_metrics_observability_spec.md) and [2_distributed_tracing_spec.md](2_distributed_tracing_spec.md). Closes the observability triad: metrics (Prometheus), traces (Jaeger), logs (Loki).

## 1. Goal

All containers' stdout logs land in one queryable store, reachable from the existing Grafana. Today each service's JSON lines live only in its container log (`docker logs`); the correlation IDs and trace IDs we now emit on every line cannot be searched across services in one place.

Primary use case this must enable: **paste a `traceId` (or `requestId`) from any layer and see every log line of that request across all services, ordered by time, next to the Jaeger trace.**

## 2. Scope

**In scope**
- Loki (storage + query) and Promtail (scrape) as Compose services on the existing `meter-hub` network.
- Scraping **all running containers'** stdout via the Docker socket — service-agnostic, so new services are covered with zero config.
- Grafana Loki datasource provisioning + a logs-focused dashboard (or Explore-ready setup) for `traceId`/`requestId` search.
- One dashboard panel pair wired to the existing overview dashboard's data source set.

**Out of scope (deferred)**
- Log-based alerting/alert rules.
- Parsing/indexing of JSON fields as Loki labels (high-cardinality trap — see §6); full JSON parsing happens at query time.
- Retention beyond Loki's default, compactor configuration tuning, S3/object-store backends, authentication (Loki multi-tenancy stays disabled — dev-grade, like Jaeger all-in-one).
- Shipping logs from non-container processes (host-local `gradlew bootRun` dev mode logs remain terminal-only).

## 3. Approach (per option analysis)

Same decision pattern as the tracing spec's option analysis: keep it dev-grade and single-binary.

| Option | Verdict |
|---|---|
| **Loki + Promtail (Docker socket)** | **Chosen.** Standard local stack, Promtail's `docker` scrape target reads container stdout via the socket, labels per container/service for free. |
| Loki + Docker `logging.driver=loki` plugin | Avoid: requires installing a Docker plugin on the host daemon — a global machine change, not project-contained. |
| Grafana Alloy | The successor to Promtail, but heavier and its config is less ubiquitous; revisit at real scale. |
| ELK/EFK | JVM-heavy for this machine; overkill for MVP log volume. |

## 4. Architecture

```
containers (json-file stdout) ──docker socket──▶ Promtail ──push──▶ Loki ──query──▶ Grafana
```

- **Promtail** mounts `/var/run/docker.sock` (read-only) and discovers containers via the Docker service discovery mechanism. Each log stream is labeled with the Compose service name (`service=<name>`, e.g. `service=api-gateway`, `service=postgres`).
- **Loki** receives pushes on 3100 (internal only), stores to a local volume.
- **Grafana** gets a Loki datasource provisioned (like the existing Prometheus one) and a "MeterHub Logs" dashboard.

## 5. Requirements

### FR-1 Compose services
`loki` and `promtail` join `docker-compose.yml` on `meter-hub-network`; configs under `infrastructure/loki/`. Loki is internal-only; Promtail internal-only. Grafana depends on Loki.

### FR-2 Config as code
Loki config (schema v13, boltdb-shipper or tsdb; filesystem storage, single replica) and Promtail config (docker_sd with relabeling to extract the Compose `service` label) are files under `infrastructure/`, mounted read-only. `docker compose up -d loki promtail` needs no manual steps.

### FR-3 Cross-service search by ID
From Grafana Explore or the logs dashboard, a query like `{service=~".+"} |= "<traceId>"` returns the request's lines from every service that handled it within seconds.

### FR-4 Dashboard
A provisioned dashboard ("MeterHub Logs") with:
- a logs panel defaulted to all services,
- quick-filter variables for `service`,
- documentation text explaining the traceId/query patterns (and linking to the Jaeger UI).

### FR-5 Resilience
With Loki down, services keep logging locally and keep serving (Docker's json-file driver is decoupled from the app); when Promtail can't push, it buffers/retries per its defaults — no service is affected. Loki's absence never fails a request (mirrors tracing spec FR-5).

### FR-6 Secrets hygiene
Nothing new: log lines already obey conventions §14 (no credentials). Promtail config contains no secrets; the Docker socket is mounted read-only.

### FR-7 Lifecycle
`docker compose logs loki` / `docker compose logs promtail` let one debug the pipeline itself; both containers must start clean with the committed configs.

## 6. Risks / Notes

- **High-cardinality labels** — never label by requestId/traceId/paths. Trace-ID search is a **line-filter** (`|= "id"`), not a label. This is the single most important Loki rule; enforced by keeping Promtail relabeling minimal.
- **JSON as logfmt at query time** — lines are already JSON; use `| json` in LogQL to extract `traceId`, `level`, etc. at query time instead of index-time parsing.
- **Docker socket exposure** — read-only mount to Promtail only; accepted for a local dev stack, consistent with the Jaeger all-in-one trust model.
- **Volume growth** — Loki default retention applies; TSDB schema + a modest retention (7d to match Prometheus) configured explicitly, not defaulted silently.
- **Promtail is in LTS-maintenance mode upstream** — fine for the dev-grade scope; the config concepts carry to Alloy if this ever graduates.

## 7. Acceptance Criteria

- [x] `docker compose up -d loki promtail` starts both containers clean with committed configs; no manual steps.
- [x] Grafana shows the provisioned Loki datasource; Explore returns lines for `{service="api-gateway"}`.
- [x] After a journey request, searching Grafana for the request's `traceId` returns log lines from the services that handled it (gateway + downstream), ordered by time.
  *(Verified with a gateway→household trace: 4 lines from api-gateway and household-service. The original "≥3 services" bar assumed the request would log in identity-service too; the actual request path only logs where there is something to log — the Jaeger trace confirms exactly the services that appeared. Adjusted accordingly.)*
- [x] "MeterHub Logs" dashboard renders with the service quick-filter working.
- [x] With Loki stopped: services keep serving and keep logging locally (FR-5); Loki restarts and picks up new lines.
- [x] Test suites unaffected (no application-code changes expected).
- [x] Docs updated: README observability section, ports table (`loki` 3100 internal-only), spec/tasks cross-links, deferred lists, spec status → Implemented.

## 9. Verification Notes (2026-09-20)

- Pipeline: Promtail discovered **12 targets** (all running containers
  incl. postgres/jaeger/grafana themselves); ~1.1k entries shipped within
  the first minute. Per-service `count_over_time` shows every Compose
  service present with the `service` label.
- Cross-service ID search: took a `traceId` from a real
  gateway→households request; `{service=~".+"} |= "<traceId>"` returned
  4 time-ordered lines from both api-gateway and household-service, and
  the same query through Grafana's datasource proxy works (that is what
  the dashboard/Explore use).
- Dashboard "MeterHub Logs" (uid `meterhub-logs`): verified rendered in
  a real browser — instructions panel, Service variable (12 values),
  live logs panel streaming all services.
- Resilience: `docker compose stop loki` — gateway health 200, web 200,
  app containers kept logging; Promtail logged retry warnings (its only
  symptom). `docker compose start loki` — new lines flow again
  immediately.
- **Detour worth recording:** docker_sd `filters` are *include* filters.
  The first promtail config used one "exclude promtail itself" — the
  result was discovery limited to promtail's container only (1 target).
  Removed the filter; promtail's own lines are dropped by a pipeline
  `drop` stage instead. Documented in the config file comments.
- No application code changed; test suites unaffected.

## 8. Task Breakdown

See [../tasks/3_log_aggregation_tasks.md](../tasks/3_log_aggregation_tasks.md).
