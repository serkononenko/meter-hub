# Metrics Observability — Task Breakdown

Spec: [1_metrics_observability_spec.md](../spec/1_metrics_observability_spec.md)
(parent PRD §12). Tasks already implemented in this session are checked
with verification notes, mirroring the style of `0_meter_hub_mvp_tasks.md`.

## Epic M1 — Prometheus collection

### M1.1 Compose service
- [x] Add `prometheus` service to `docker-compose.yml` on the `meter-hub` network.
- [x] Publish host port 9090; keep service metric endpoints internal-only.
- [x] Add `prometheus_data` volume with 7-day retention flag.

### M1.2 Scrape configuration
- [x] Create `infrastructure/prometheus/prometheus.yml` (15s interval).
- [x] Scrape gateway / identity / household via `/actuator/prometheus`.
- [x] Scrape meter / reading via `/metrics`.
- [x] Document the two metric dialects in the config comments.

### M1.3 Verify collection
- [x] All five targets report `up` (checked via `api/v1/targets`).
- [x] `sum(up) == 5` through the query API.
- [x] Counters increment after generated traffic (incl. 401s, per 10.4).

## Epic M2 — Grafana visualization

### M2.1 Compose service & provisioning
- [x] Add `grafana` service (host 3001 → container 3000), depends on Prometheus.
- [x] Bind-mount `infrastructure/grafana/provisioning/` and `dashboards/` read-only.
- [x] Admin credentials via `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` (default `admin`/`admin`), sign-up disabled.
- [x] Add `grafana_data` volume.

### M2.2 Datasource & dashboard provisioning
- [x] Provision Prometheus datasource with fixed UID `meterhub-prometheus`.
- [x] Provision "MeterHub Overview" dashboard from
  `infrastructure/grafana/dashboards/meterhub-overview.json`.

### M2.3 Dashboard content
- [x] Spring panels: request rate, p95 latency, 5xx rate (Micrometer
  `http_server_requests_seconds*`, `outcome` tags), JVM heap.
- [x] NestJS panels: request rate, p95 latency, 5xx rate (prom-client
  `http_requests_total` / `http_request_duration_seconds`, `status` label), process CPU.
- [x] Platform row: "scrape targets up" stat (green at 5) + target table.

### M2.4 Histogram support for quantiles
- [x] Enable `management.metrics.distribution.percentiles-histogram.http.server.requests`
  in the three Spring services (prom-client histograms publish buckets by default).
  First attempt used a nonexistent `management.observations…histogram` key —
  caught because Prometheus showed 0 `_bucket` series; corrected property
  produced 345 bucket series across the three services.

### M2.5 Verify visualization
- [x] Datasource query through Grafana's proxy: `sum(up) = 5`.
- [x] Dashboard renders with populated panels in the browser (Playwright).

## Epic M3 — Documentation

### M3.1 Docs
- [x] README: "Metrics stack" section, env-var table entries, endpoints.
- [x] `docs/ports.md`: Prometheus 9090 and Grafana 3001 entries.
- [x] `.env.example`: Grafana admin vars (commented, defaults in Compose).
- [x] Task 10.4 note points here instead of carrying the full follow-up text.
- [x] This spec + breakdown pair created and cross-linked.

## Open (deferred — see spec §8)

- [ ] Alertmanager alerting rules (target down, sustained 5xx) + notification path.
- [ ] Loki log aggregation (separate spec).
- [ ] OpenTelemetry tracing (separate deferred experiment).
- [ ] Auth/TLS on the metrics plane if deployed beyond localhost.
- [ ] Per-service drill-down dashboards, if the overview proves insufficient.
