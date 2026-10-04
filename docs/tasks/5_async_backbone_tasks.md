# Async Backbone (Kafka, Outbox, Idempotent Consumers) — Task Breakdown

Spec: [../spec/5_async_backbone_spec.md](../spec/5_async_backbone_spec.md) (roadmap Phase 2).
Workflow mirrors the metrics (M1–M3), tracing (T1–T2), log-aggregation (L1–L3) and
membership-roles (R1–R7) breakdowns: tick a box only after live verification, record
detours honestly. Open questions from the spec are resolved there (§11): KRaft single
broker, JSON Schema + generated types, at-least-once + consumer dedup, in-process
retries → DLQ, relay inside reading-service, denormalized unit.

Service reality this builds on (verified 2026-10-02):

- `docker-compose.yml` currently has 11 services (postgres, five app services, web,
  prometheus, grafana, jaeger, loki, promtail); port 9092 is reserved for Kafka in
  `docs/ports.md` ("Planned").
- Reading Service's `POST /readings` path (`reading.service.ts::_createReading`) ends
  in a single `ReadingRepository.save` via Prisma; no transaction wrapper exists yet.
  The idempotency-key path (C3) wraps replay lookup + save in the service layer.
- `contracts/events/` exists, empty, reserved since the MVP.
- Prometheus already scrapes all services; Grafana dashboards are provisioned from
  `infrastructure/` files.

## Epic K1 — Kafka in Compose & event contract

K1.1 Broker
- [x] Add `kafka` service to `docker-compose.yml`: official `apache/kafka` image,
      KRaft single-node, listeners for `kafka:9092` (Compose network) plus the
      host-published 9092 for CLI inspection, named volume, healthcheck gating
      `service_healthy`. (Landed as INTERNAL kafka:9092 + HOST localhost:29092 —
      the broker's own 9092 stays network-internal, host publishes 29092 so the
      two listeners don't fight over one port.)
- [x] Live check: broker comes up with `docker compose up -d`, topic can be created
      and consumed from the host CLI and from inside the network. (Live 2026-10-02:
      container healthy, topic created, produced+consumed via `kafka:9092` inside
      the network and via `localhost:29092` from a host-side container.)
- [x] `docs/ports.md` row moves from "Planned" to active; README architecture notes.

K1.2 Event contract
- [x] `contracts/events/meter/reading-created.v1.json` — JSON Schema of the envelope
      (spec §7): `eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`,
      `data {readingId, meterId, value, unit, recordedAt, source}`. (Landed as
      `reading-created.v1.schema.json`; `unit`/`source` enums mirror the
      meter-service contract's `MeterUnit` and the reading contract's `source` pin.)
- [x] Codegen: TypeScript types generated from the schema for producer and consumer
      (mirror the OpenAPI → generated-client flow; document the command).
      (`contracts/events/generate.sh <service-root>` — json2ts into
      `src/generated/events/`; reading-service wired, consumer service follows in K3.)
- [x] Redocly-style lint is N/A here, but the schema validates with a chosen JSON
      Schema validator and a fixture payload passes. (ajv 2020-12 + formats:
      fixture valid; wrong `unit`, unknown field, missing `recordedAt` all rejected.)

## Epic K2 — Outbox in Reading Service

K2.1 Table & write path
- [x] Prisma migration: `reading_outbox` table (`id` = eventId, `aggregate_id`,
      `event_type`, `payload` JSONB, `traceparent` nullable, `created_at`,
      `published_at` nullable) with index on unpublished scan. (Landed 4ec641a:
      partial index on `created_at WHERE published_at IS NULL`.)
- [x] Reading save inserts the reading row and the outbox row atomically; envelope
      built per spec §7 in ReadingService, `traceparent` read from the CLS request
      store inside OutboxRepository (no parameter threading). Transaction
      orchestration lives in ReadingService via `TransactionManager.execute`;
      `ReadingRepository.save` / `OutboxRepository.save` take an optional tx client.
- [x] Idempotency-key replay path returns the stored response **without** writing a
      second outbox row (reading.service: replay returns `existing.responseBody`
      before `_createReading` is ever called).

K2.2 Relay
- [x] `OutboxRelay` in reading/reading (domain owner): poll unpublished ordered by
      `created_at`, bounded batch (100), publish to `meter.reading.created`, mark
      `published_at` after the batch (single UPDATE — atomic on its own; the
      at-least-once guarantee comes from produce-before-mark ordering); produce
      headers carry the stored `traceparent`. (Live-verified 2026-10-03: Kafka
      message headers `eventId` + `traceparent` present.)
- [x] Relay metrics (prom-client): published total, publish errors, round errors,
      unpublished backlog gauge. Series owned by `OutboxMetricsListener` in
      metrics/ — the relay emits domain events (`reading.outbox.*`) over
      @nestjs/event-emitter and knows nothing about prom-client. (Deviation: no
      round-latency histogram — the four series above cover the operational
      questions; add if a dashboard needs it, K4 will tell.)
- [x] Broker down → events queue in the table (no error storm); broker back →
      backlog drains. (Live 2026-10-04: stopped kafka, submitted reading → e2e
      passed, row queued with backlog gauge 2 / publish_errors +1; restarted
      kafka → backlog drained to 0, published_total +2.)
- [x] Unit tests: outbox row + reading row committed together via the
      TransactionManager flow (service spec asserts both writes on one tx),
      relay FIFO ordering, failed publish stops the batch and leaves the row
      unpublished with `publish_failed` emitted, failed mark → `round_failed` and
      re-publish next round (at-least-once). 59/59 passing.

## Epic K3 — Demo consumer & shared scaffolding

K3.1 `events-demo` service
- [x] New Compose service (Node, own database/schema on the shared Postgres per
      conventions §11/§16): subscribes to `meter.reading.created`, logs the reading,
      records `eventId` in a dedup table before processing (dedup checked first —
      redelivery is a no-op). (Landed 2026-10-04: `events_demo_db`/`events_demo_user`
      in the init script, `processed_events` table, Prisma migration applied at
      container start. First boot replayed all 277 backlog events and recorded
      every eventId.)
- [x] Health/metrics/tracing wired like the other services (readiness probe, prom-client,
      span per event with the event's `traceparent` as parent/link). (Live: `/health/ready`
      DB-backed; Prometheus scrapes `events-demo:8085` — target up; consumer span
      `meter.reading.created process` carries a FOLLOWS_FROM link to the producing
      request's trace — verified on trace `791f8937`, one waterfall across
      gateway → reading → meter/household → consumer.)
- [x] Topics declared idempotently at startup. (Live: `createTopics` both topic and
      `<topic>.dlq`, TOPIC_ALREADY_EXISTS accepted — restart logs show the accept
      path and green start.)

K3.2 Consumer scaffolding (extracted, documented in conventions §15)
- [x] Shared consumer loop: bounded in-process exponential-backoff retries, then
      publish to `<topic>.dlq` with failure headers (reason, attempts, last exception
      class), commit, move on. (`ConsumerLoop` in src/consumer/consumer-loop.ts;
      `ConsumerMetrics` fixed series names; the demo's handler subclasses the loop.)
- [x] Conventions §15 gains the retry/DLQ policy text and the header set. (Landed as
      §15.1 "Event consumer policy (Kafka)".)
- [x] Unit tests: poison message → DLQ after budget while later messages on the
      partition still process; redelivery deduped. (6/6 passing, including malformed
      messages skipping the budget and store failures rethrowing. Live-verified too:
      offset reset -12 → all 12 redeliveries deduped, `deduped_total 12` /
      `processed_total 0`; valid-envelope poison → `failed_total 4` then DLQ headers
      `reason/attempts:4/exceptionClass:TypeError/originalTopic/deadLetteredAt`,
      lag stayed 0; missing-eventId and unparseable-JSON → DLQ straight.)

## Epic K4 — Observability

- [x] Kafka lag exporter container in Compose, scraped by the existing Prometheus.
      (Landed as `kafka-exporter` service — `danielqsj/kafka-exporter:v1.10.0`, the
      spec's named candidate — `--kafka.server=kafka:9092`, metrics on 9308 internal
      only, healthchecked, `depends_on` kafka healthy. Prometheus job added; scrape
      config needs a container restart to be picked up — bind-mounted file isn't
      re-read live. Live 2026-10-04: target up; `kafka_consumergroup_lag
      {consumergroup="events-demo",topic="meter.reading.created"} 0`.)
- [x] Grafana "Async backbone" dashboard (provisioned, in `infrastructure/`): consumer
      group lag, outbox unpublished backlog, publish/consume rates, DLQ depth.
      (`meterhub-async-backbone.json`: brokers-up stat, lag + current-offset
      timeseries, outbox backlog stat + publish/error rates, consumed/processed/
      deduped + failed/DLQ rates, DLQ topic offset stat + trend. All 14 panel
      expressions executed against live Prometheus and returned series; DLQ topic
      currently holds the 4 K3 poison messages so the depth panel shows real data.
      Note: DLQ regex uses `[.]` — PromQL rejects `\.` in `topic=~".+\.dlq"` with
      "unknown escape sequence".)
- [x] Services-overview dashboard/prometheus config updated for the new targets
      (kafka exporter, events-demo). (Overview NestJS panels now include
      events-demo; "scrape targets up" stat threshold raised 5 → 7. Verified
      `sum(up)` = 7 with every target healthy.)

## Epic K5 — End-to-end verification & docs

- [x] Extend e2e: after the existing reading submission journey, assert the event
      lands on `meter.reading.created` and matches the v1 schema; kill/restart the
      demo consumer mid-stream and assert no double-processing; assert DLQ via a
      forced poison (test hook) or documented manual step. (`e2e/async-backbone.e2e.test.mjs`,
      3 tests: schema-valid event + outbox published_at + traceparent header;
      valid-envelope poison data:null → DLQ with all 5 failure headers after the
      4-attempt budget; stop/produce-2/restart → group replays, exactly one dedup
      row each, consumer log lines show processing. Kafka via localhost:29092,
      kafkajs/ajv resolved from services/events-demo/node_modules; DB asserts via
      psql in the postgres container. Gotcha logged for future tests: kafkajs
      `fetchOffsets` returns `[{topic, partitions: [{offset}]}]`, and consumer
      position must be seeked inside `run()` (pause → seek → resume), not before.
      Full suite 6/6 local. Deviation: no in-code test hook — poison is produced
      directly to the topic, documented as the manual step too.)
- [x] Jaeger check: one waterfall for a reading submission spans HTTP → relay →
      consumer (traceparent continuity through the async leg). (Live 2026-10-04:
      trace `2017e0f4…` — 62 spans gateway → reading-service tx outbox INSERT →
      meter/household ownership checks; consumer span `meter.reading.created
      process` in trace `3df8e15e…` carries `FOLLOWS_FROM` → `2017e0f4…` and
      `messaging.event.id` == the outbox row id `f2e554f0…`. Note: the consumer
      leg is a separate trace linked FOLLOWS_FROM, by design — Jaeger shows them
      side by side, not as one literal trace.)
- [x] Restart whole stack (`docker compose down && up`) — dedup table and outbox
      survive; no duplicate events after restart replay. (Live 2026-10-04 — and it
      caught a real bug first: apache/kafka:4.0.0 defaults `log.dirs` to a /tmp
      path inside the container, so the `kafka_data` volume mount was dead and
      every restart lost all topics/offsets/events. Fixed with
      `KAFKA_LOG_DIRS: /var/lib/kafka/data` in both compose files. After the fix:
      down + up → topic offset 1 preserved, group resumes at it, dedup table 305
      → 312 rows as new events flow, zero duplicate event_ids, zero
      double-processing log lines.)
- [x] Docs: README architecture + dev-mode notes (Kafka section), `docs/ports.md`,
      backlog entry for the phase's accepted trade-offs if any surface. (README:
      Kafka dev-mode notes with CLI inspection + manual poison drill, Async
      backbone observability section, e2e section, start-stack/reset wording.
      Backlog: new K1 — non-UUID eventId header crashes the dedup insert outside
      the retry path and blocks the partition (found during e2e development;
      tests use UUIDs and document the trap). ports.md already had the
      kafka-exporter row from K4.)
- [x] CI: e2e job covers the new journey (already `node --test e2e/` since 1b01d27).
      (Added: setup-node + `npm ci --ignore-scripts` for events-demo in the e2e
      job — the async tests import kafkajs/ajv from that tree; jobs stay green
      only in CI runs, verified next push.)
