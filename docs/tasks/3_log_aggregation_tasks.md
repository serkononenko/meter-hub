# Log Aggregation Tasks — Loki + Promtail

Spec: [../spec/3_log_aggregation_spec.md](../spec/3_log_aggregation_spec.md). Workflow mirrors the metrics (M1–M3) and tracing (T1–T4) breakdowns: tick a box only after live verification, record detours honestly.

## Epic L1 — Loki + Promtail in Compose

### L1.1 Loki service
- [x] `infrastructure/loki/loki-config.yml` (TSDB schema, filesystem storage, 7d retention, single binary mode).
- [x] Compose `loki` service on `meter-hub`, internal-only, `loki_data` volume.

### L1.2 Promtail service
- [x] `infrastructure/loki/promtail-config.yml` (docker service discovery via read-only socket, relabel to a low-cardinality `service` label).
- [x] Compose `promtail` service, socket read-only mount, depends_on loki.

### L1.3 Pipeline healthy
- [x] Both containers start clean; Promtail shows discovered targets for all running containers; a test line from a service arrives in Loki (query API check).

## Epic L2 — Grafana integration

### L2.1 Datasource
- [x] Provision Loki datasource (`infrastructure/grafana/provisioning/datasources/loki.yml`, uid `meterhub-loki`).

### L2.2 Logs dashboard
- [x] "MeterHub Logs" dashboard: logs panel, `service` variable, usage-notes text panel (traceId search pattern + Jaeger link).

## Epic L3 — End-to-end verification & docs

### L3.1 Cross-service ID search
- [x] Run a journey request; search its `traceId` in Grafana/LogQL — lines from every service that handled the request come back time-ordered (adjusted from "≥3": a request only logs where there is something to log; the Jaeger trace's service list is the source of truth).

### L3.2 Resilience
- [x] Stop Loki; services keep serving and logging; restart Loki; new lines flow again.

### L3.3 Docs & bookkeeping
- [x] README observability section + ports table row.
- [x] Cross-links: metrics spec deferred entry, tracing spec note, MVP task 11.x/deferred list, roadmap item.
- [x] Spec status → Implemented with verification notes.

---

## Verification Notes (2026-09-20)

- **L1.3:** first start shipped only promtail's own lines — docker_sd
  `filters` turned out to be include filters (the "exclude self" filter
  limited discovery to promtail). Fix: no filter + a pipeline `drop`
  stage for promtail's own lines. After restart: 12 docker targets,
  >1k entries/min, `sum by (service) (count_over_time(...))` shows all
  12 Compose services.
- **L2:** datasource uid `meterhub-loki` + dashboard uid `meterhub-logs`
  provision on Grafana start; verified via Grafana API and in-browser
  screenshot (logs streaming, Service variable populated).
- **L3.1:** traceId from a gateway→households request found in both
  services' streams, time-ordered. Note: a request only appears in the
  services that actually logged something — cross-check against the
  Jaeger trace's service list, not an assumed count.
- **L3.2:** stop/start loki — apps unaffected, promtail retries, new
  lines flow after restart.
- Loki kept internal-only (no host port); all queries go through
  Grafana or `docker exec`/compose-network containers.
