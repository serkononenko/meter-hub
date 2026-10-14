# Alerting — Specification

**Status:** Draft
**Version:** 0.1
**Parent:** [roadmap.md](../roadmap.md) Phase 1.3, backlog item O1
**Depends on:** Specs 1 (metrics), 3 (logs), 5 (async backbone metrics)
**Feeds:** Phase 5 Notifications (reuses the Telegram bot), Phase 7 Device Automation (offline-device alerts)

Task breakdown: [../tasks/7_alerting_tasks.md](../tasks/7_alerting_tasks.md).

## 1. Overview

Prometheus, Grafana, Jaeger and Loki are deployed with provisioned
dashboards, but nothing fires: someone has to be looking at a dashboard
to notice a problem. This spec adds the missing last step — alert rules
on the existing Prometheus and Loki, an Alertmanager that routes them,
and Telegram as the first notification channel.

No new services, APIs, events or databases. Everything is infrastructure
config under `infrastructure/`, wired into both Compose files.

## 2. Goals

- A stopped or unreachable service raises an alert within a couple of
  minutes and a resolved notification when it returns.
- Sustained HTTP 5xx, flapping targets, a growing consumer lag, a
  stuck outbox and dead-lettered messages each have a rule.
- Log-level error spikes raise an alert via Loki.
- Alerts arrive in Telegram; the same bot is reused by Phase 5.
- The stack boots and stays healthy with no Telegram credentials
  (CI, fresh clone): alerts are still visible in Prometheus and
  Alertmanager, they are just not delivered.
- Alert definitions are versioned config, testable offline
  (`promtool test rules`).

## 3. Non-Goals

- Paging, on-call schedules, escalation, silencing UI beyond Alertmanager's own.
- Email or other channels (Phase 5 adds channels for user notifications).
- Business-level alerts (reminders, devices) — later phases add rules into
  the same files.
- Auth/TLS on the observability plane (backlog O3 / roadmap Phase 8).
- Container-level metrics (cAdvisor); restarts are inferred from `up`.
- Alertmanager clustering / HA.

## 4. Architecture

```text
Prometheus ──rules──▶ Alertmanager ──▶ Telegram
Loki (ruler) ─rules──▶ Alertmanager
Grafana ── reads Alertmanager (datasource, alert list)
```

- **Alertmanager** (`prom/alertmanager`, port 9093, internal; host
  port in dev only) on the `meter-hub` network.
- **Prometheus** loads rule files from `infrastructure/prometheus/rules/`
  and is pointed at Alertmanager.
- **Loki ruler** loads rule files from `infrastructure/loki/rules/`
  (tenant `fake`, since `auth_enabled: false`) and sends to Alertmanager.
- Grafana gets an Alertmanager datasource and an alert-list panel on the
  overview dashboard.

## 5. Notification path and secrets

- `ALERTMANAGER_TELEGRAM_BOT_TOKEN` and `ALERTMANAGER_TELEGRAM_CHAT_ID`
  come from env (`.env`, `stack.env`, Portainer variables); placeholders go
  in `.env.example` and `stack.env.example`. Real values are never committed.
- Alertmanager's config has no env expansion and `chat_id` must be an
  integer, so the container starts through a small entrypoint that renders
  `alertmanager.yml.tmpl` into the final config.
  - Both vars set → `telegram` receiver.
  - Either unset → a receiver with no integrations, and a log line saying
    delivery is disabled. The container stays healthy.
- Messages show severity, alert name, service/job, summary and a link to the
  relevant Grafana dashboard; resolved notifications are sent.
- Grouping by `alertname` + `job`, `group_wait` 30s, `group_interval` 5m,
  `repeat_interval` 4h; a `critical` alert inhibits `warning` alerts of the
  same `job`.

## 6. Alert catalog

Severity is `critical` (service-affecting) or `warning` (degrading). Every
rule carries `summary` and `description` annotations and a `dashboard`
link. `for:` durations are chosen to ride out a normal restart (the
service healthchecks allow ~30–60 s).

| Alert | Expression (sketch) | For | Sev |
|---|---|---|---|
| `TargetDown` | `up == 0` | 2m | critical |
| `TargetFlapping` | `changes(up[15m]) >= 4` | 0m | warning |
| `HighErrorRateSpring` | 5xx share of `http_server_requests_seconds_count` > 5% with a minimum request rate | 5m | critical |
| `HighErrorRateNest` | 5xx share of `http_requests_total` > 5% with a minimum request rate | 5m | critical |
| `HighLatencyP95` | p95 of request duration > 1s | 10m | warning |
| `KafkaBrokerDown` | `kafka_brokers < 1` | 2m | critical |
| `ConsumerLagGrowing` | `kafka_consumergroup_lag > 100` and not decreasing | 10m | warning |
| `OutboxBacklog` | `reading_outbox_unpublished` / `provider_outbox_unpublished` > 50 | 5m | warning |
| `OutboxPublishErrors` | `rate(*_outbox_publish_errors_total[5m]) > 0` | 5m | warning |
| `DeadLetteredMessages` | `increase(consumer_dlq_messages_total[15m]) > 0` | 0m | warning |
| `LogErrorSpike` (Loki) | error-level lines per service over a threshold | 5m | warning |

"Readiness flapping" from the backlog is covered by `TargetFlapping`:
services expose liveness only (backlog O7 — readiness and peer probes
were deliberately skipped so a dead dependency cannot cascade restarts),
and `up` flipping is the observable symptom. Thresholds above are
starting points; epic A2 tunes them against real traffic and records the
final values here.

## 7. Operations

- **Compose parity.** Alertmanager and the rule mounts exist in both
  `docker-compose.yml` and `docker-compose.portainer.yml` (the latter binds
  configs under `${REPO_DIR}`, state under `infrastructure/alertmanager/data`,
  no host port).
- **Healthcheck.** Alertmanager `/-/healthy`.
- **Deploy docs.** `docs/deploy-portainer.md` gains the bot-creation steps
  and the two variables; `docs/ports.md` lists 9093.
- **Rule hygiene.** `promtool check rules` and `promtool test rules` run in
  CI so a broken rule fails the PR instead of silently never firing.

## 8. Security & privacy

- The bot token is a secret: never in the repo, logs or this chat. Alertmanager
  is not published in prod.
- Alert text carries service names and counts only — no user or household data.
- Telegram receives alert content; that is acceptable because it is
  operational metadata.

## 9. Acceptance criteria ("done when")

1. `docker compose up` starts Alertmanager healthy with no Telegram vars set;
   Prometheus shows all rule groups loaded and `/api/v2/status` on Alertmanager
   shows the delivery-disabled receiver.
2. Stopping `reading-service` makes `TargetDown` go pending → firing in
   Alertmanager within ~3 minutes, and resolve after restart.
3. With the bot configured, that firing and the resolution each arrive in
   Telegram.
4. A forced error spike in a service's logs fires `LogErrorSpike`.
5. `promtool test rules` covers each Prometheus rule and passes in CI.
6. Portainer compose has the same wiring; the deploy doc describes the
   variables.
7. Backlog O1 is moved to Resolved with evidence.

## 10. Decisions to confirm

- **D1 Channel:** Telegram only in v1. *(Proposed — confirmed in discussion.)*
- **D2 Loki alerts in scope:** yes, via the Loki ruler. *(Proposed.)*
- **D3 Boot without credentials:** yes, delivery disabled with a log line. *(Proposed.)*
- **D4 Restart detection:** no cAdvisor; `TargetFlapping` stands in. Revisit
  if a crash-looping container goes unnoticed.
- **D5 Image pinning:** pin `prom/alertmanager` to a specific version, like the
  other observability images.
