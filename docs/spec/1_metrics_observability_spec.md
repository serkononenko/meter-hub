# Metrics Observability — Prometheus & Grafana Spec

**Status:** Implemented (partial — see §8 Remaining Work)
**Version:** 0.1
**Parent:** [0_meter_hub_mvp_prd.md](0_meter_hub_mvp_prd.md) §12 Observability Requirements
**Tasks:** [1_metrics_observability_tasks.md](../tasks/1_metrics_observability_tasks.md)

## 1. Overview

The MVP services expose Prometheus-format metrics (task 10.4), but metrics
nobody scrapes are dead weight. This spec covers the collection and
visualization layer: a Prometheus instance that scrapes every service over
the Compose network, and a Grafana instance with provisioned datasources
and dashboards, both startable with the rest of the platform via Docker
Compose.

Scope is deliberately local-development grade: one Prometheus, one
Grafana, file-based configuration committed to the repo, no service
discovery beyond Compose DNS names, no federation or long-term storage.

## 2. Goals

- Every service's metric endpoint is scraped automatically, with no
  manual UI configuration.
- Grafana comes up with datasource and dashboards already provisioned —
  opening http://localhost:3001 shows useful charts immediately.
- The whole stack is reproducible from a clean checkout: all Prometheus
  and Grafana configuration lives in `infrastructure/` as files.
- Dashboards answer the basic operational questions: is each service up,
  how much traffic, how fast, how many errors.
- Both metric dialects in the polyglot codebase are treated as first
  class: Micrometer (Spring) and prom-client (NestJS) use different
  metric names and label sets, and the dashboards reflect that rather
  than pretending one query fits both.

## 3. Non-Goals

- Alerting (Alertmanager, notification channels) — later phase.
- Log aggregation (Loki) — separate spec; correlation IDs in structured
  logs are the current story.
- Distributed tracing (OpenTelemetry) — done since; see [2_distributed_tracing_spec.md](2_distributed_tracing_spec.md).
- Long-term storage, high availability, federation, multi-environment
  scraping.
- TLS / authentication on the metrics plane (fine for localhost; revisit
  before anything internet-reachable — see §8).
- Business metrics (registrations per day, readings per household) —
  tracked separately if ever needed.

## 4. Architecture

```
┌────────────┐  scrape /actuator/prometheus   ┌────────────────────┐
│ Prometheus │───────────────────────────────▶│ gateway :8080      │
│  :9090     │───────────────────────────────▶│ identity :8081     │
│            │───────────────────────────────▶│ household :8082    │  (Micrometer)
│            │  scrape /metrics               ├────────────────────┤
│            │───────────────────────────────▶│ meter :8083        │
│            │───────────────────────────────▶│ reading :8084      │  (prom-client)
└─────┬──────┘                                └────────────────────┘
      │ datasource (http://prometheus:9090)
┌─────▼──────┐
│  Grafana   │  dashboards provisioned from infrastructure/grafana/
│  :3001     │
└────────────┘
```

- All six containers join the existing `meter-hub` Compose network.
- Service metric endpoints stay internal-only (`expose`, not `ports`);
  only Prometheus, the gateway, PostgreSQL, and the web app publish host
  ports (docs/ports.md).
- Prometheus targets are static Compose DNS names — no service discovery.
- Grafana provisions datasource + dashboards at startup from
  `infrastructure/grafana/provisioning/`; nothing is configured by hand
  in the UI.

## 5. Metric Dialects

| Stack | Services | Endpoint | Key metrics |
|---|---|---|---|
| Micrometer | api-gateway, identity, household | `/actuator/prometheus` | `http_server_requests_seconds_count/sum/_bucket` (tags: `uri`, `method`, `status`, `outcome`), `jvm_memory_used_bytes`, `application_ready_time_seconds` |
| prom-client | meter, reading | `/metrics` | `http_requests_total` (`method`, `path`, `status`), `http_request_duration_seconds` (histogram), `process_cpu_seconds_total`, `nodejs_eventloop_lag_*` |

Requirements carried over from task 10.4 and kept true here:

- Low-cardinality labels only (`uri` template / stripped `path` — no raw
  IDs, no correlation IDs as labels).
- Rejected/auth-failed requests are counted too (middleware placement in
  NestJS; Micrometer filters cover them).
- The Spring services publish histogram buckets via
  `management.metrics.distribution.percentiles-histogram.http.server.requests`
  so latency quantiles are computable; prom-client histograms have
  buckets by default.

## 6. Functional Requirements

### 6.1 Prometheus

- FR-1: Runs as a Compose service on the `meter-hub` network, reachable
  from the host on port 9090.
- FR-2: Scrapes all five services every 15s using their internal DNS
  names; config file is `infrastructure/prometheus/prometheus.yml`,
  bind-mounted read-only.
- FR-3: Retains 7 days of local data in a named volume.
- FR-4: Scrape configuration documents both metric paths and the reason
  for the dialect split.

### 6.2 Grafana

- FR-5: Runs as a Compose service on port 3001 (host) → 3000 (container),
  after Prometheus.
- FR-6: Admin credentials come from `GRAFANA_ADMIN_USER` /
  `GRAFANA_ADMIN_PASSWORD` (default `admin`/`admin` for local dev,
  documented in `.env.example` and README).
- FR-7: The Prometheus datasource is provisioned with a fixed UID
  (`meterhub-prometheus`) so dashboard JSON can reference it.
- FR-8: The "MeterHub Overview" dashboard is provisioned at startup
  covering, for both dialects: request rate, p95 latency, 5xx rate, plus
  JVM heap / Node process CPU and scrape-target health (stat + table).
- FR-9: Sign-up is disabled; dashboards/datasources are read-only enough
  that a fresh container reproduces them.

### 6.3 Dashboards (content contract)

- FR-10: Request-rate and latency panels separate Spring and NestJS
  services (different metric names); 5xx panels use `outcome` tags for
  Micrometer and `status` label for prom-client.
- FR-11: "Scrape targets up" stat turns green at 5 (all services) and
  the target table shows per-service endpoint health.

## 7. Acceptance Criteria

- [x] `docker compose up -d prometheus grafana` starts both from a clean
  checkout; no manual configuration steps.
- [x] All five scrape targets report `up` in Prometheus
  (`sum(up) == 5`).
- [x] Grafana serves the provisioned datasource and "MeterHub Overview"
  dashboard at http://localhost:3001 without UI setup.
- [x] Panels populate after generating traffic (verified through
  Grafana's datasource proxy and in the browser).
- [x] Spring p95 panels resolve (histogram buckets present — 345 series
  across the three services after enabling the distribution property).
- [x] `docker compose down` + `up` keeps the provisioning working
  (config is file-based; only metric history lives in volumes).

## 8. Remaining Work (tracked in the task breakdown)

- Alerting rules (e.g., target down, sustained 5xx) — needs Alertmanager
  and a notification path; deferred.
- Per-service dashboards beyond the overview if needed.
- Auth on the metrics plane if this ever leaves localhost.
- Loki for logs — separate spec, keeps this one metrics-only.
