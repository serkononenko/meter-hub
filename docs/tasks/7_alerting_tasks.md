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
- [ ] (Partly seen: with only Prometheus + Alertmanager running, all 8 `TargetDown` alerts went pending → firing and reached Alertmanager. The stop-one-service drill and resolve are still to do.) Stop `reading-service`: `TargetDown` pending → firing within ~3 min in Alertmanager; restart:
      resolves. Record the observed timings.

## Epic A3 — Loki alerts, Telegram and close-out

A3.1 Loki ruler
- [ ] Enable `ruler` in `loki-config.yml` (storage under the rules directory, Alertmanager URL); mount
      `infrastructure/loki/rules/fake/` in both Compose files.
- [ ] `LogErrorSpike` rule (per-service error-level line count); check the exact field/label from the
      existing promtail pipeline and the logs dashboard before writing the LogQL.
- [ ] Verification: force an error burst, alert fires in Alertmanager.

A3.2 Dashboard
- [ ] Alert-list panel on the overview dashboard; firing count stat.

A3.3 Telegram (needs the bot)
- [ ] Create the bot with @BotFather, find the chat ID, set the variables in `stack.env` /
      Portainer. Never commit or paste the token.
- [ ] Fire drill end to end: firing and resolved messages both arrive in Telegram.

A3.4 Docs and close-out
- [ ] `docs/deploy-portainer.md`: bot creation, variables, how to silence.
- [ ] `docs/ports.md`: 9093.
- [ ] Backlog O1 → Resolved with evidence; roadmap Phase 1.3 note updated; Phase 7 device alerts
      referenced as the next consumer.
- [ ] Portainer compose diffed against dev for parity (alertmanager, rules mounts, Loki ruler).
