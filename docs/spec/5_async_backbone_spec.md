# Async Backbone (Kafka, Outbox, Idempotent Consumers) — Specification

**Status:** Draft
**Version:** 0.1
**Parent:** [0_meter_hub_mvp_prd.md](0_meter_hub_mvp_prd.md) §15 Phase 6 (pulled forward to roadmap Phase 2), [roadmap.md](../roadmap.md) Phase 2
**Tasks:** [5_async_backbone_tasks.md](../tasks/5_async_backbone_tasks.md)

## 1. Overview

Everything so far in MeterHub is synchronous: service-to-service HTTP, request-scoped
traces, no events. The roadmap's next phases (Reminders, Notifications, Providers,
Devices) all consume *facts* — a reading was recorded, a meter was registered, a
schedule came due — rather than answer queries. This phase introduces the async
backbone they will stand on, with no user-facing features of its own.

Scope: a single dev-grade Kafka broker in Compose; an outbox in Reading Service so
`meter.reading.created` is published exactly-once-equivalent with the DB write;
event contracts under `contracts/events/`; one demo consumer proving idempotent
processing across service restarts; a documented retry/dead-letter policy; consumer
lag in Prometheus/Grafana; trace propagation through the async leg so a reading
shows up in Jaeger as one waterfall including its event.

Deliberately local-development grade, matching the observability specs' stance
([1_metrics_observability_spec.md](1_metrics_observability_spec.md) §1): one broker,
no cluster, no schema registry, file-based configuration committed to the repo.

## 2. Goals

- Creating a reading durably produces a `meter.reading.created` event — the DB row
  and the event cannot diverge (no "saved but never published", no "published but
  not saved").
- At-least-once delivery is the contract; consumers dedup by stable event ID, so
  processing is idempotent even across consumer restarts and redeliveries.
- A message that repeatedly fails processing ends in a dead-letter topic instead of
  blocking the partition, and its arrival is observable (metric + dashboard row).
- Consumer lag per group is scraped and graphed, so the demo (and Phase 3+ consumers)
  can be watched falling behind.
- Trace context survives produce → consume: the event carries `traceparent` and the
  consumer starts a linked span, so Jaeger shows the async continuation of the
  original HTTP request.
- The whole thing comes up with `docker compose up -d` from a clean checkout, like
  everything else.

## 3. Non-Goals

- Real consumers with domain behavior (Reminders = Phase 3, Notifications = Phase 4) —
  the demo consumer exists only to prove the backbone.
- Multi-broker Kafka, replication factors > 1, Kafka Raft migrations, TLS/SASL on the
  internal listener — dev-grade single node; hardening rides Phase 1's A1 service
  trust model and Phase 7 scale-out work.
- Schema registry and Avro/Protobuf — event schemas are versioned JSON Schema files
  plus generated TypeScript types (same generated-client philosophy as the OpenAPI
  contracts).
- New events beyond `meter.reading.created` (`MeterCreated`, `HouseholdCreated` are
  named in the roadmap but arrive with the phases that need them; the outbox pattern
  documents how to add them).
- Publish-side exactly-once transactions (Kafka transactions) — outbox + at-least-once
  + consumer dedup is the chosen trade-off (§11.5).
- Migration of existing readings — events flow for newly created readings only.

## 4. Kafka in Compose

Single broker, KRaft mode (no ZooKeeper), official `apache/kafka` image, dev-grade
single-node configuration on the reserved port 9092 (`docs/ports.md`).

- `infrastructure/kafka/` holds broker configuration fragments that Compose mounts;
  anything expressible as environment variables stays in `compose.yaml` following the
  existing services' pattern.
- One listener for the Compose network (`kafka:9092`, PLAINTEXT). The host-published
  port 9092 exists for ad-hoc CLI inspection (`kafka-console-consumer` from the host);
  listeners are configured so both access paths work (advertised listener pairs).
- Health: the compose healthcheck uses the broker's own metadata probe
  (`kafka-broker-api-versions --bootstrap-server localhost:9092` or the
  `/v1/status`-equivalent the official image provides) so dependents can use
  `service_healthy` like Postgres.
- Data lives in a named volume; `docker compose down -v` discards it, consistent with
  the disposable-stack stance (backlog O2).
- One shared topic-naming and partitioning policy (§6): demo topics are single-partition;
  keys are set (meterId) but partition count is a dev-grade constant.

## 5. Outbox pattern in Reading Service

`POST /api/v1/readings` currently does: validate → meter lookup → access verdict →
non-decreasing check → `readingRepository.save` (Prisma). The event must be atomic
with that save, so it is written to an outbox table **in the same Prisma
transaction**, then published by a relay.

- New table `reading_outbox` (Prisma migration in reading-service's database):
  - `id` — the event ID (UUID, generated at write time; this is the dedup key
    consumers see).
  - `aggregate_id` — meterId (for indexing/queries).
  - `event_type` — `meter.reading.created`.
  - `payload` — JSONB event body (§7 envelope with the full event, not a delta).
  - `traceparent` — W3C header value captured from the creating request (nullable:
    scheduled/idempotent-replay writes may have none; consumers then start a root span).
  - `created_at`, `published_at` (nullable).
- `ReadingRepository.save` becomes a transaction that inserts the reading row and the
  outbox row together; the idempotency-key path (C3) reuses the same transaction so
  replays do not double-publish — a replay that finds an existing key returns the
  stored response without writing a second outbox row.
- **Relay** (`OutboxRelay`, a NestJS component started with the service): polls
  `published_at IS NULL` ordered by `created_at`, publishes each event to Kafka,
  marks `published_at` in a batch transaction. At-least-once: a crash between produce
  and mark re-publishes on restart — consumer dedup absorbs it.
  - Poll interval short (hundreds of ms); batch size bounded; loop tolerant to broker
    downtime (events simply queue in the table — the outbox is the buffer, which is
    the point of the pattern).
  - Publish order per partition is best-effort FIFO by `created_at` (single partition,
    single relay instance per the MVP one-instance deployment).
- No cleanup policy in this phase beyond documenting the row-growth expectation; a
  retention job arrives with the first real consumer phase if needed.

## 6. Topics and naming

Conventions §15 naming: lowercase dot-separated domain events.

- Topic `meter.reading.created` — the event and the topic share the name (one event
  type per topic for now; fine-grained topic-per-event keeps consumer subscriptions
  explicit).
- Retry and dead-letter topics are derived: `meter.reading.created.retry` and
  `meter.reading.created.dlq` (§9).
- Topics are declared in code/config at consumer/producer startup (idempotent create),
  not by a separate provisioner — dev-grade.

## 7. Event envelope and contracts

`contracts/events/meter/reading-created.v1.json` (JSON Schema) is the source of
truth; TypeScript types are generated from it into reading- and consumer-side code,
mirroring the OpenAPI → Orval flow.

```json
{
  "eventId": "uuid (== outbox id)",
  "eventType": "meter.reading.created",
  "eventVersion": 1,
  "occurredAt": "RFC3339 — reading.createdAt",
  "producer": "reading-service",
  "data": {
    "readingId": "uuid",
    "meterId": "uuid",
    "value": 1042,
    "unit": "KWH",
    "recordedAt": "RFC3339",
    "source": "MANUAL"
  }
}
```

- Rules: `eventId` is stable forever and unique per event (it is the outbox row ID);
  `eventVersion` bumps on breaking payload changes (new topic version rather than
  in-place mutation); `unit` is denormalized from the meter so consumers never call
  back synchronously for it.
- Kafka headers carry `traceparent` (continuity for Jaeger) and `eventId` duplicated
  for tooling that filters headers without parsing payloads.
- Tracing: produce and consume are span-linked — the relay continues the stored
  `traceparent` for the produce span; the consumer starts a span with the event's
  `traceparent` as parent, so Jaeger assembles one waterfall across the HTTP leg,
  the relay poll, and the consumer. Follows the conventions of
  [2_distributed_tracing_spec.md](2_distributed_tracing_spec.md).

## 8. Demo consumer

A minimal consumer proving the pipeline end to end. To keep services honest about
ownership (no fake domain coupling), it lives in a small dedicated Compose service
`events-demo` (Node, same generated event types):

- Subscribes to `meter.reading.created`, "processes" each event by recording the
  event ID in a small dedup store and logging the reading (structured log, same
  conventions as the services).
- **Idempotency:** processed event IDs persist in a Postgres table (dedicated schema
  in its own database on the shared instance, per conventions §11/§16) — a redelivered
  event is recognized and skipped, proven by tests that force redelivery (restart the
  consumer mid-batch, replay from earliest offset).
- Traces and metrics like every other service, so lag and span continuity work for it
  from day one.
- It is explicitly a demo: Phase 3+ consumers replace it; nothing else depends on it.

## 9. Retry and dead-letter policy

Documented policy, implemented in the shared consumer scaffolding the demo uses
(extracted so Phase 3+ consumers inherit it):

- In-flight failure → retry in-process with bounded exponential backoff
  (config: attempts, base delay) — dev-grade; no retry *topics* round-trips unless a
  consumer actually needs to defer across restarts (§11.6).
- After the attempt budget is exhausted the message is published to
  `<topic>.dlq` with headers recording the failure reason, attempt count, and last
  exception class; the consumer then commits and moves on — a poisoned message
  cannot block the partition.
- DLQ depth is a Prometheus metric (`events_demo_dlq_messages_total` on the demo;
  per-consumer gauge in the shared scaffolding) and a Grafana panel; DLQ content is
  inspectable with console tooling.
- The policy (budget, backoff shape, DLQ header set) is written into
  `docs/conventions.md` §15 so future consumers follow one pattern instead of five.

## 10. Observability hookup

- **Lag:** a Kafka lag exporter container (e.g. `danielqsj/kafka_exporter` or
  equivalent that exposes `kafka_consumergroup_current_offset` /
  `kafka_consumergroup_lag`) is added to Compose and scraped by the existing
  Prometheus; the provisioned Grafana gains an "Async backbone" dashboard row:
  consumer group lag, relay outbox backlog (`reading_outbox` unpublished count as a
  gauge), publish/consume rates, DLQ depth.
- **Relay metrics** in reading-service (prom-client, existing conventions): outbox
  published total, publish errors, relay round latency, current unpublished backlog.
- The existing services-overview dashboard gains the kafka exporter target; alerting
  rules on lag/DLQ stay out of scope (backlog O1 owns alerting).

## 11. Resolved decisions

1. **KRaft, no ZooKeeper** — the official image's single-node KRaft mode; one less
   container, nothing in the dev topology needs ZK semantics.
2. **Outbox in Reading Service only, for one event** — `meter.reading.created` is the
   only producer this phase; adding `MeterCreated`/`HouseholdCreated` later means
   replicating a pattern, not designing a framework.
3. **JSON Schema + generated types over schema registry** — keeps the
   contract-first, generated-client workflow the repo already uses for OpenAPI; a
   registry is Phase 7+ scale-out territory.
4. **Demo consumer is a separate Compose service** — avoids inventing a fake reason
   for meter/household-service to consume; the point is proving the backbone, and the
   service boundary rule (conventions §16) stays untouched.
5. **At-least-once + consumer dedup over Kafka exactly-once transactions** — simpler
   producer path, dedup table is trivial, and the guarantee consumers actually need
   (idempotency under redelivery) is exercised and tested rather than delegated.
6. **In-process retries + DLQ topic over retry topics** — retry topics exist to defer
   work across restarts and keep partitions free; at this volume a bounded in-process
   backoff then DLQ gives the same observable outcome with three fewer topics. The
   policy text names the retry-topic escalation path if a future consumer needs it.
7. **Relay inside reading-service, not a sidecar** — one less deployment unit; the
   relay is just a loop over a table the service already owns. If publish throughput
   ever matters, extracting it is mechanical.
8. **Unit denormalized into the event** — consumers must not need the meter API to
   interpret a reading; the meter's unit cannot change for a given reading anyway.

## 12. Acceptance criteria ("done when")

- [ ] Creating a reading via `POST /readings` produces `meter.reading.created` on the
      topic, and the event payload matches `contracts/events/...reading-created.v1.json`
      (e2e asserts schema conformance).
- [ ] Killing reading-service between DB save and publish (or between produce and
      mark) loses nothing and duplicates nothing observably: redelivery is deduped by
      the demo consumer.
- [ ] Demo consumer restart mid-stream reprocesses without double-processing
      (dedup store proven by test).
- [ ] A payload that fails processing ends in `meter.reading.created.dlq` after the
      retry budget, the partition keeps flowing, and DLQ depth is visible in Grafana.
- [ ] Consumer group lag is scraped and graphed; the Jaeger waterfall for a reading
      spans HTTP → outbox relay → consumer via `traceparent`.
- [ ] The full stack, Kafka included, comes up green from a clean checkout with
      `docker compose up -d` and the journey test still passes.
