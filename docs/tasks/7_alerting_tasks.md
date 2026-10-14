# Alerting — Task Breakdown

Spec: [../spec/7_alerting_spec.md](../spec/7_alerting_spec.md) (roadmap Phase 1.3, backlog O1).
Workflow mirrors the earlier breakdowns: tick a box only after live verification, record
detours honestly. Decisions D1–D5 are drafted in spec §10 — confirm before starting A1.

Three epics, shippable in order. No Telegram bot is needed until A3.3; A1–A2 are verified
through the Alertmanager UI.

Reality this builds on (verified 2026-10-14):

- Prometheus scrapes 8 jobs (`prometheus.yml`), 15 s interval, no `rule_files`, no `alerting`.
- Spring services expose `http_server_requests_seconds_*` (outcome label); NestJS services expose
  `http_requests_total` (status label). Async metrics: `kafka_consumergroup_lag`, `kafka_brokers`,
  `reading_outbox_unpublished`, `provider_outbox_unpublished`, `*_outbox_publish_errors_total`,
  `consumer_dlq_messages_total`.
- Loki has `rules_directory: /loki/rules` configured but no ruler block; `auth_enabled: false`.
- Services have liveness healthchecks only (O7); there is no readiness endpoint and no cAdvisor.
- Compose files diverge in paths: dev uses named volumes and relative mounts, Portainer uses
  `${REPO_DIR}` bind mounts and no host ports. Every addition must land in both.

## Epic A1 — Alertmanager and the notification path

A1.1 Service
- [x] `infrastructure/alertmanager/alertmanager.yml.tmpl` and an entrypoint script that renders it
      from `ALERTMANAGER_TELEGRAM_BOT_TOKEN` / `_CHAT_ID`; both set → `telegram` receiver, else an
      empty receiver and a log line.
- [x] Routing: group by `alertname`, `job`; `group_wait` 30s, `group_interval` 5m, `repeat_interval` 4h;
      critical-inhibits-warning per `job`; `send_resolved: true`.
- [x] Telegram message template (severity, alert, job, summary, dashboard link).
- [x] Compose service `alertmanager` (pinned image, healthcheck `/-/healthy`, 9093 internal; host port
      in dev only) in `docker-compose.yml` **and** `docker-compose.portainer.yml`.

A1.2 Wiring
- [x] Prometheus `alerting:` block and `rule_files:`; mount `infrastructure/prometheus/rules/` in both
      Compose files.
- [x] Grafana Alertmanager datasource provisioned (file added; not yet seen loaded in a running Grafana).
- [x] Env placeholders in `.env.example` and `stack.env.example` (empty by default).

A1.3 Verification
- [x] Stack boots healthy with the Telegram vars unset; delivery-disabled log line present.
- [x] Rendered config validated with `amtool check-config` for both branches (vars set / unset). Detour: checked by hand in a throwaway container, not a committed script test — still worth adding.
- [x] Prometheus `/api/v1/alertmanagers` lists the instance as active.

## Epic A2 — Prometheus rules

A2.1 Rule files (`infrastructure/prometheus/rules/`)
- [x] `platform.rules.yml`: `TargetDown`, `TargetFlapping`, `HighErrorRateSpring`, `HighErrorRateNest`,
      `HighLatencyP95` (minimum-rate guards so an idle service cannot divide by ~0).
- [x] `async.rules.yml`: `KafkaBrokerDown`, `ConsumerLagGrowing`, `OutboxBacklog`, `OutboxPublishErrors`,
      `DeadLetteredMessages`.
- [x] Every alert has `severity`, `summary`, `description`, `dashboard` annotations.

A2.2 Tests and tuning
- [x] `promtool check rules` and `promtool test rules` fixtures for every alert (fires, does not fire,
      resolves); wired into CI so a broken rule fails the PR.
- [ ] Thresholds and `for:` values reviewed against a day of real local traffic; final values recorded
      in spec §6. **Not done:** thresholds are still the spec's starting points; the stack has had no real traffic yet.

A2.3 Verification
- [x] Stop `reading-service` on the full dev stack (2026-10-14): stopped 10:12:45 → `TargetDown` pending, firing at ~10:15:00 (≈2m15s: `for: 2m` plus a scrape/eval interval), visible in Alertmanager; restarted 10:15:09 → resolved by 10:15:24. Only `reading-service` alerted. Detour: the `web` container could not bind host port 3000 (another container on this machine holds it), so it was left down — unrelated to alerting.

## Epic A3 — Loki alerts, Telegram and close-out

A3.1 Loki ruler
- [x] Enable `ruler` in `loki-config.yml` (storage under the rules directory, Alertmanager URL); mount
      `infrastructure/loki/rules/fake/` in both Compose files.
- [x] `LogErrorSpike` rule (per-service error-level line count); check the exact field/label from the
      existing promtail pipeline and the logs dashboard before writing the LogQL.
- [x] Verification (2026-10-14): ruler loaded the rule (`health: ok`). A one-off burst of 15 synthetic ERROR lines went pending but dropped back under the threshold before `for: 5m` elapsed, so it correctly did not fire. A sustained ~9 ERROR lines/min from 10:26:45 fired `LogErrorSpike{service=reading-service}` in Alertmanager at ~10:33. The resolve after the lines stopped was not observed. Lines were synthetic (written to the container's stdout), not a real failure.

A3.2 Dashboard
- [x] Overview dashboard: "Alerts firing" stat and an active-alerts table (Prometheus `ALERTS`; Loki alerts are visible only in Alertmanager, noted in the panel description). Verified 2026-10-14 through the Grafana API: the dashboard serves panels 14–16 and both panel queries return a data frame via `/api/ds/query` (200). Not looked at in a browser, so visual layout is unchecked.

A3.3 Telegram (needs the bot)
- [x] Create the bot with @BotFather, find the chat ID, set the variables in `stack.env` /
      Portainer. Never commit or paste the token.
- [x] Fire drill end to end (2026-10-14): `TargetDown` for `reading-service` — FIRING message at ~11:03, RESOLVED at ~11:09 (`group_interval` batching), both confirmed received in Telegram by the user; Alertmanager reported 0 Telegram failures.

A3.4 Docs and close-out
- [x] `docs/deploy-portainer.md`: bot creation, variables, how to silence.
- [x] `docs/ports.md`: 9093.
- [x] Backlog O1 → Resolved with evidence; roadmap Phase 1.3 note updated; Phase 7 device alerts
      referenced as the next consumer.
- [x] Portainer compose diffed against dev for parity: alertmanager service, Prometheus rules mount, Loki ruler mount all present; only path style (`${REPO_DIR}` binds) and state storage (bind dir vs named volume) differ. **Not run:** the Portainer stack was never started. Risk to check on first deploy: `infrastructure/alertmanager/data` is a bind mount, and Alertmanager runs as a non-root user, so the host directory may need to be writable (same situation as the existing Prometheus/Loki data dirs).

## Baseline observation (2026-10-14, ~1h of idle local stack)

Over the 3 hours before 11:16, the only alerts that were pending or firing were `TargetDown`, all during
the drills and the earlier stopped-stack period (10:07–10:12, 10:13–10:15, 11:02–11:05). No alert
fired spontaneously while the stack was healthy, including `TargetFlapping`, the error-rate alerts,
`ConsumerLagGrowing` and `OutboxBacklog`. This is weak evidence only: the stack saw ~0.1 req/s per
service of health/metrics scrapes and no user traffic, so the 5xx, latency and lag thresholds were
never approached (p95 ≈ 5 ms, lag 0, outbox 0). Threshold tuning (A2.2) therefore stays open until
there is real usage.
