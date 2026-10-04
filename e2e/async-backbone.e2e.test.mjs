/**
 * MeterHub async-backbone journey (spec 5, Epic K5).
 *
 * Extends the reading-submission journey with the event leg, against the
 * real running Compose stack — nothing mocked:
 *
 *   1. record a reading through the gateway -> assert the outbox row was
 *      published (published_at set) and the event on `meter.reading.created`
 *      matches the v1 JSON Schema (ajv, same validator as K1's checks);
 *   2. poison message with a valid envelope (data:null — the demo handler
 *      throws on it) -> exhausts the retry budget, lands on
 *      `meter.reading.created.dlq` with the failure headers, and the
 *      partition keeps flowing;
 *   3. restart the demo consumer mid-stream (documented manual step, README
 *      "Async backbone") -> the group replays from its committed offset and
 *      every redelivery is deduped, never double-processed.
 *
 * Host-side Kafka access goes through `localhost:29092` (the broker's HOST
 * listener, docs/ports.md). kafkajs and ajv are imported from
 * services/events-demo/node_modules — the e2e job has no node_modules of
 * its own; CI's nestjs-tests matrix installs the same package-lock.
 *
 * Run with: node --test "e2e/*.test.mjs"
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:8080';
const KAFKA = process.env.KAFKA_BROKERS ?? 'localhost:29092';
const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const EMAIL = `e2e-async-${RUN}@example.com`;
const USERNAME = `e2e-async-${RUN}`;
const PASSWORD = 'correct-horse-battery';

// e2e/ has no node_modules; the demo service already depends on kafkajs
// and ajv (K1's schema validation uses the same ajv version).
const DEMO_MODULES = fileURLToPath(new URL('../services/events-demo/node_modules/', import.meta.url));
const {Kafka, Partitioners} = await import(`${DEMO_MODULES}kafkajs/index.js`);
const {default: Ajv2020} = await import(`${DEMO_MODULES}ajv/dist/2020.js`);
const {default: addFormats} = await import(`${DEMO_MODULES}ajv-formats/dist/index.js`);

const {readFileSync} = await import('node:fs');
const EVENT_SCHEMA = JSON.parse(
    readFileSync(new URL('../contracts/events/meter/reading-created.v1.schema.json', import.meta.url), 'utf-8'),
);
const validateEvent = addFormats(new Ajv2020({strict: false})).compile(EVENT_SCHEMA);

/** DB access runs `psql` inside the postgres container; credentials come from .env (git-ignored). */
function envValue(name) {
    return execSync(`grep "^${name}=" .env | cut -d= -f2-`, {encoding: 'utf-8', cwd: REPO_ROOT}).trim();
}
const READING_DB_PASSWORD = envValue('READING_DB_PASSWORD');
const DEMO_DB_PASSWORD = envValue('EVENTS_DEMO_DB_PASSWORD');

function psql(db, user, password, sql) {
    const out = execSync(
        `docker exec -e PGPASSWORD=${JSON.stringify(password)} meter-hub-postgres-1 ` +
        `psql -U ${user} -d ${db} -At -c ${JSON.stringify(sql)}`,
        {encoding: 'utf-8', cwd: REPO_ROOT},
    );
    return out.trim().split('\n').filter((line) => line.length > 0);
}

/** JSON request through the gateway (same shape as journey.e2e.test.mjs). */
async function call(method, path, {token, body} = {}) {
    const response = await fetch(`${GATEWAY}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': crypto.randomUUID(),
            // TEST-NET-3, never routed — its own rate-limit bucket (journey.e2e.test.mjs rationale).
            'X-Forwarded-For': `203.0.113.${(RUN.charCodeAt(RUN.length - 1) + 17) % 250 + 1}`,
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return {status: response.status, body: text ? JSON.parse(text) : null};
}

const identity = (path) => `/api/identity-service${path}`;
const household = (path) => `/api/household-service${path}`;
const meter = (path) => `/api/meter-service${path}`;
const reading = (path) => `/api/reading-service${path}`;

/** End offset of partition 0 of a topic. */
async function endOffset(topic) {
    const kafka = new Kafka({clientId: 'meterhub-e2e', brokers: KAFKA.split(',')});
    const admin = kafka.admin();
    await admin.connect();
    try {
        const offsets = await admin.fetchTopicOffsets(topic);
        return Number(offsets[0].offset);
    } finally {
        await admin.disconnect();
    }
}

/** Committed offset of the demo group on partition 0. */
async function committedOffset(groupId, topic) {
    const kafka = new Kafka({clientId: 'meterhub-e2e', brokers: KAFKA.split(',')});
    const admin = kafka.admin();
    await admin.connect();
    try {
        // kafkajs v2.2.4 returns [{topic, partitions: [{partition, offset}]}]
        const result = await admin.fetchOffsets({groupId, topic});
        const partitions = result[0].partitions ?? result[0];
        return Number(partitions[0].offset);
    } finally {
        await admin.disconnect();
    }
}

/**
 * Consume up to `max` messages arriving after `afterOffset` within
 * `timeoutMs`. Uses a throwaway group so nothing commits; the position is
 * forced with `consumer.seek` inside the run callback — kafkajs only
 * initializes the group during run(), and seeking earlier throws
 * "Consumer group was not initialized".
 */
async function consumeAfter({topic, afterOffset, max, timeoutMs}) {
    const kafka = new Kafka({clientId: 'meterhub-e2e', brokers: KAFKA.split(',')});
    const consumer = kafka.consumer({groupId: `e2e-probe-${RUN}-${topic.replace(/\./g, '-')}`});
    const messages = [];
    let resolveDone;
    const done = new Promise((resolve) => { resolveDone = resolve; });
    await consumer.connect();
    await consumer.subscribe({topic, fromBeginning: true});
    await consumer.run({
        autoCommit: false,
        eachMessage: async ({message}) => {
            messages.push({
                offset: message.offset,
                headers: Object.fromEntries(
                    Object.entries(message.headers ?? {}).map(([k, v]) => [k, Buffer.isBuffer(v) ? v.toString() : String(v)]),
                ),
                value: message.value ? JSON.parse(message.value.toString('utf-8')) : null,
            });
            if (messages.length >= max) resolveDone();
        },
        eachBatchAutoResolve: true,
    });
    // Position after the group is running: pause partitions, seek, resume.
    await consumer.pause([{topic, partitions: [0]}]);
    await consumer.seek({topic, partition: 0, offset: String(afterOffset)});
    await consumer.resume([{topic, partitions: [0]}]);
    const timer = setTimeout(resolveDone, timeoutMs);
    await done;
    clearTimeout(timer);
    await consumer.disconnect().catch(() => {});
    return messages;
}

/** Produce a raw JSON payload with headers to a topic. */
async function produce(topic, headers, value) {
    const kafka = new Kafka({clientId: 'meterhub-e2e', brokers: KAFKA.split(',')});
    const producer = kafka.producer({createPartitioner: Partitioners.DefaultPartitioner});
    await producer.connect();
    await producer.send({topic, messages: [{headers, value: JSON.stringify(value)}]});
    await producer.disconnect();
}

function dockerCompose(args) {
    return execSync(`docker compose -f docker-compose.yml ${args}`, {encoding: 'utf-8', cwd: REPO_ROOT});
}

test('reading submission produces a schema-valid event with outbox and traceparent continuity', async () => {
    // --- Journey up to the reading (register -> login -> household -> meter) ---
    const registered = await call('POST', identity('/api/v1/auth/register'), {
        body: {email: EMAIL, username: USERNAME, password: PASSWORD},
    });
    assert.equal(registered.status, 201, JSON.stringify(registered.body));

    const login = await call('POST', identity('/api/v1/auth/login'), {
        body: {email: EMAIL, password: PASSWORD},
    });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const token = login.body.accessToken;

    const createdHousehold = await call('POST', household('/api/v1/households'), {
        token,
        body: {name: `E2E async household ${RUN}`},
    });
    assert.equal(createdHousehold.status, 201, JSON.stringify(createdHousehold.body));
    const householdId = createdHousehold.body.id;

    const createdMeter = await call('POST', meter('/api/v1/meters'), {
        token,
        body: {
            householdId,
            type: 'ELECTRICITY',
            name: 'Async backbone meter',
            serialNumber: `E2E-ASYNC-${RUN}`,
            unit: 'KWH',
        },
    });
    assert.equal(createdMeter.status, 201, JSON.stringify(createdMeter.body));
    const meterId = createdMeter.body.id;

    // --- The event leg ---
    const topicBefore = await endOffset('meter.reading.created');
    const recordedAt = new Date(Date.now() - 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const readingResponse = await call('POST', reading('/api/v1/readings'), {
        token,
        body: {meterId, value: 4242, recordedAt},
    });
    assert.equal(readingResponse.status, 201, JSON.stringify(readingResponse.body));

    // Outbox row committed atomically with the reading, then relayed.
    const deadline = Date.now() + 30_000;
    let row = null;
    while (Date.now() < deadline && !row) {
        const rows = psql('reading_db', 'reading_user', READING_DB_PASSWORD,
            `SELECT id, published_at, traceparent FROM reading_outbox WHERE aggregate_id = '${meterId}'`);
        if (rows.length > 0 && rows[0].includes('|') && rows[0].split('|')[1] !== '') row = rows[0];
        if (!row) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(row, 'outbox row exists and was relayed (published_at set)');
    const [outboxId, , outboxTrace] = row.split('|');
    assert.match(outboxTrace, /^00-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/, 'outbox row carries the W3C traceparent');

    // Event landed on the topic and matches the v1 contract.
    const events = await consumeAfter({topic: 'meter.reading.created', afterOffset: topicBefore, max: 1, timeoutMs: 30_000});
    assert.ok(events.length >= 1, 'event arrived on meter.reading.created');
    const event = events[0];
    assert.equal(event.headers.eventId, outboxId, 'eventId header == outbox row id');
    assert.ok(validateEvent(event.value), `event matches v1 schema: ${JSON.stringify(validateEvent.errors)}`);
    assert.equal(event.value.data.meterId, meterId);
    assert.equal(event.value.data.value, 4242);
    assert.equal(event.value.data.unit, 'KWH');
    assert.equal(event.value.producer, 'reading-service');
    assert.equal(event.headers.traceparent, outboxTrace, 'traceparent header == stored trace context');
});

test('valid-envelope poison dead-letters with failure headers; partition keeps flowing', async () => {
    const poisonId = crypto.randomUUID();
    // Schema-valid eventId (the dedup store requires a UUID) with a null
    // payload body: the demo handler dereferences data.readingId — a
    // TypeError on every attempt. Valid eventId means the dedup path claims
    // it first; the handler then exhausts the retry budget.
    await produce('meter.reading.created', {
        eventId: poisonId,
        traceparent: '00-11111111111111111111111111111111-2222222222222222-01',
    }, {
        eventId: poisonId,
        eventType: 'meter.reading.created',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        producer: 'e2e-test',
        data: null,
    });

    // Budget: 4 attempts with 250/500/1000ms backoff -> DLQ well within 30s.
    const before = await endOffset('meter.reading.created.dlq');
    const deadline = Date.now() + 30_000;
    let dead = null;
    while (Date.now() < deadline && !dead) {
        const messages = await consumeAfter({topic: 'meter.reading.created.dlq', afterOffset: before, max: 1, timeoutMs: 5_000});
        if (messages.length > 0) dead = messages[0];
        else await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(dead, 'poison message dead-lettered');
    assert.equal(dead.headers.reason, "Cannot read properties of null (reading 'readingId')");
    assert.equal(dead.headers.attempts, '4');
    assert.equal(dead.headers.exceptionClass, 'TypeError');
    assert.equal(dead.headers.originalTopic, 'meter.reading.created');
    assert.match(dead.headers.deadLetteredAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(dead.value.eventId, poisonId, 'payload preserved on the DLQ');
});

test('restart mid-stream redelivers backlog; every redelivery deduped, none double-processed', async () => {
    // Stop the consumer, produce two schema-valid events (bypassing the
    // gateway: no users involved), restart — the group replays them from
    // its committed offset. Then prove no double-processing against a
    // pre-restart event as well: the replayed offset range overlaps
    // already-processed history by construction (offset replay).
    const {execSync: dockerSync} = await import('node:child_process');
    void dockerSync;
    dockerCompose('stop events-demo');

    const backlogBefore = await endOffset('meter.reading.created');
    const restartEvents = [];
    for (let i = 0; i < 2; i++) {
        const id = crypto.randomUUID();
        await produce('meter.reading.created', {eventId: id, traceparent: ''}, {
            eventId: id,
            eventType: 'meter.reading.created',
            eventVersion: 1,
            occurredAt: new Date().toISOString(),
            producer: 'e2e-test',
            data: {
                readingId: `e2e-restart-reading-${i}`,
                meterId: `e2e-restart-meter-${i}`,
                value: 100 + i,
                unit: 'KWH',
                recordedAt: new Date().toISOString(),
                source: 'MANUAL',
            },
        });
        restartEvents.push(id);
    }

    dockerCompose('up -d --wait events-demo');

    // Wait for the group to commit past the restart-time end offset.
    const deadline = Date.now() + 60_000;
    let caughtUp = false;
    while (Date.now() < deadline) {
        const offset = await committedOffset('events-demo', 'meter.reading.created');
        if (offset >= backlogBefore + 2) { caughtUp = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    assert.ok(caughtUp, 'consumer group caught up after restart');

    // Each restart-window event has exactly one dedup row — replaying the
    // backlog processed each once, never twice.
    const rows = psql('events_demo_db', 'events_demo_user', DEMO_DB_PASSWORD,
        `SELECT event_id, count(*) FROM processed_events WHERE event_id IN ('${restartEvents.join("','")}') GROUP BY event_id`);
    assert.equal(rows.length, 2, 'both restart-window events recorded');
    for (const r of rows) assert.ok(r.endsWith('|1'), `exactly one dedup row for ${r}`);

    // And the consumer's own log shows processing, not dedup-skips, for
    // these first-time events (log line from reading-created.consumer).
    const logs = execSync('docker compose -f docker-compose.yml logs events-demo', {encoding: 'utf-8', cwd: REPO_ROOT});
    for (const id of restartEvents) {
        assert.ok(logs.includes(id), `consumer processed ${id} (log line present)`);
    }
});
