/**
 * MeterHub provider-service end-to-end journey (Phase 3, Epic P8).
 *
 * Drives the provider journey through the API gateway against the running
 * Docker Compose environment:
 *
 *   admin (from IDENTITY_ADMIN_USER_IDS) creates a catalog provider with a
 *   default window -> household member creates an account -> binds a meter
 *   -> submission windows answer -> viewer reads but cannot write
 *   -> non-admin gets FORBIDDEN_SYSTEM_ROLE on catalog writes
 *   -> admin without membership gets 404 on the household's accounts
 *   -> supplier switch (end binding + rebind) keeps rows
 *   -> overlapping binding rejected with METER_ALREADY_BOUND
 *   -> provider.account.changed / provider.binding.changed observed on Kafka
 *
 * Nothing is mocked: HTTP goes to the gateway (http://localhost:8080 by
 * default, override with GATEWAY_URL), Kafka is consumed on the host
 * listener (localhost:29092, see docs/ports.md). Each run registers unique
 * users so it can be re-run against a persistent database.
 *
 * The admin identity comes from the deployment configuration: the test
 * registers a fresh user, appends its id to IDENTITY_ADMIN_USER_IDS in .env,
 * and restarts identity-service so the reconciliation runner promotes it
 * (docs/api-examples.md, "To become an administrator"). The .env edit is
 * reverted afterwards; the registered user stays (persistent DB, unique
 * email) but demotes back to USER on the next identity-service restart.
 *
 * Run with: node --test e2e/
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:8080';
const KAFKA = process.env.KAFKA_BROKERS ?? 'localhost:29092';
const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const PASSWORD = 'correct-horse-battery';

// e2e/ has no node_modules; the demo service already depends on kafkajs
// and ajv (see async-backbone.e2e.test.mjs for the rationale).
const DEMO_MODULES = fileURLToPath(new URL('../services/events-demo/node_modules/', import.meta.url));
const {Kafka, Partitioners} = await import(`${DEMO_MODULES}kafkajs/index.js`);
const {default: Ajv2020} = await import(`${DEMO_MODULES}ajv/dist/2020.js`);
const {default: addFormats} = await import(`${DEMO_MODULES}ajv-formats/dist/index.js`);

const ACCOUNT_EVENT_SCHEMA = JSON.parse(
    readFileSync(new URL('../contracts/events/provider/account-changed.v1.schema.json', import.meta.url), 'utf-8'),
);
const BINDING_EVENT_SCHEMA = JSON.parse(
    readFileSync(new URL('../contracts/events/provider/binding-changed.v1.schema.json', import.meta.url), 'utf-8'),
);
const validateAccountEvent = addFormats(new Ajv2020({strict: false})).compile(ACCOUNT_EVENT_SCHEMA);
const validateBindingEvent = addFormats(new Ajv2020({strict: false})).compile(BINDING_EVENT_SCHEMA);

async function call(method, path, {token, body, client = 0} = {}) {
    const response = await fetch(`${GATEWAY}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': crypto.randomUUID(),
            // Distinct TEST-NET-3 address per actor: the gateway's auth
            // limiter is IP-keyed (see journey.e2e.test.mjs).
            'X-Forwarded-For': `203.0.113.${(RUN.charCodeAt(RUN.length - 1) + client * 13) % 250 + 1}`,
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
const provider = (path) => `/api/provider-service${path}`;

/** Registers and logs in a fresh user; returns {userId, token, email}. */
async function newUser(who) {
    const email = `e2e-prov-${RUN}-${who}@example.com`;
    const username = `e2e-prov-${RUN}-${who}`;
    const registered = await call('POST', identity('/api/v1/auth/register'), {
        body: {email, username, password: PASSWORD},
        client: 1,
    });
    assert.equal(registered.status, 201, JSON.stringify(registered.body));
    const token = await loginAs({email}, 2);
    return {userId: registered.body.id, token, email};
}

/** Logs in; returns a fresh access token (roles are minted at login). */
async function loginAs(user, client) {
    const login = await call('POST', identity('/api/v1/auth/login'), {
        body: {email: user.email, password: PASSWORD},
        client,
    });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    return login.body.accessToken;
}

/** Appends a value to a comma-separated .env key; returns an undo function. */
function addToDotEnv(key, value) {
    const path = `${REPO_ROOT}/.env`;
    const original = readFileSync(path, 'utf-8');
    const existing = original.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (existing) {
        // An empty declared value (e.g. the CI .env from .env.example) must
        // not grow a leading comma — a malformed list element fails Spring
        // binding and identity-service never starts.
        const joined = existing[1].trim() ? `${existing[1]},${value}` : value;
        const updated = original.replace(
            new RegExp(`^${key}=.*$`, 'm'),
            `${key}=${joined}`,
        );
        writeFileSync(path, updated);
    } else {
        writeFileSync(path, `${original.endsWith('\n') ? original : original + '\n'}${key}=${value}\n`);
    }
    return () => writeFileSync(path, original);
}

function composeExec(args) {
    return execSync(`docker compose -f docker-compose.yml ${args}`, {encoding: 'utf-8', cwd: REPO_ROOT});
}

/**
 * Wait for identity-service readiness after a restart. The service is
 * internal-only and the gateway would 401 the probe, so readiness is
 * polled from inside the compose network (the grafana container has
 * busybox wget) — same approach as the CI e2e job.
 */
async function awaitIdentityReady(deadlineMs = 120_000) {
    const deadline = Date.now() + deadlineMs;
    while (Date.now() < deadline) {
        try {
            composeExec('exec -T grafana wget -q -O /dev/null http://identity-service:8081/actuator/health/readiness');
            return;
        } catch {
            // starting — keep waiting
        }
        await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    throw new Error('identity-service did not become ready after restart');
}

/**
 * Promote userId to ADMIN by declaring it and restarting identity-service —
 * the reconciliation runner promotes listed users on startup. Returns the
 * .env undo function; the caller must run it and awaitIdentityReady() again.
 */
async function becomeAdmin(userId) {
    const undo = addToDotEnv('IDENTITY_ADMIN_USER_IDS', userId);
    composeExec('up -d --force-recreate --no-deps identity-service');
    try {
        await awaitIdentityReady();
    } catch (error) {
        undo();
        throw error;
    }
    return undo;
}

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

/**
 * Consume up to `max` messages arriving after `afterOffset` within
 * `timeoutMs`, with a throwaway consumer group (nothing commits).
 * Position is forced with seek inside run() — kafkajs only initializes
 * the group there (see async-backbone.e2e.test.mjs).
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
                headers: Object.fromEntries(
                    Object.entries(message.headers ?? {}).map(([k, v]) => [k, Buffer.isBuffer(v) ? v.toString() : String(v)]),
                ),
                value: message.value ? JSON.parse(message.value.toString('utf-8')) : null,
            });
            if (messages.length >= max) resolveDone();
        },
        eachBatchAutoResolve: true,
    });
    await consumer.pause([{topic, partitions: [0]}]);
    await consumer.seek({topic, partition: 0, offset: String(afterOffset)});
    await consumer.resume([{topic, partitions: [0]}]);
    const timer = setTimeout(resolveDone, timeoutMs);
    await done;
    clearTimeout(timer);
    await consumer.disconnect().catch(() => {});
    return messages;
}

test('admin curates the catalog; a household links its meters; Kafka carries the snapshots', async () => {
    // --- Users: admin-to-be, owner of the household, its viewer ---
    const adminUser = await newUser('admin');
    const owner = await newUser('owner');
    const viewer = await newUser('viewer');

    const undoAdmin = await becomeAdmin(adminUser.userId);
    try {
        // The roles claim is minted at login — re-login after promotion.
        const admin = {...adminUser, token: await loginAs(adminUser, 3)};
        const me = await call('GET', identity('/api/v1/users/me'), {token: admin.token, client: 3});
        assert.deepEqual(me.body.roles, ['USER', 'ADMIN'], 'declared user carries the ADMIN role after reconciliation');

        // --- Catalog write requires the ADMIN system role ---
        const rule = {
            cycle: 'MONTHLY',
            opens: {kind: 'DAY_OF_MONTH', day: 5},
            closes: {kind: 'DAY_OF_MONTH', day: 20},
            timezone: 'Europe/Kyiv',
        };
        const nonAdminCatalog = await call('POST', provider('/api/v1/providers'), {
            token: owner.token,
            body: {scope: 'GLOBAL', name: `Not an admin ${RUN}`},
            client: 4,
        });
        assert.equal(nonAdminCatalog.status, 403);
        assert.equal(nonAdminCatalog.body.code, 'FORBIDDEN_SYSTEM_ROLE');

        const catalog = await call('POST', provider('/api/v1/providers'), {
            token: admin.token,
            body: {scope: 'GLOBAL', name: `City Power ${RUN}`, defaultRule: rule},
            client: 3,
        });
        assert.equal(catalog.status, 201, JSON.stringify(catalog.body));
        assert.equal(catalog.body.scope, 'GLOBAL');
        assert.deepEqual(catalog.body.defaultRule, rule);
        const providerId = catalog.body.id;

        // --- Household, meter, viewer membership ---
        const createdHousehold = await call('POST', household('/api/v1/households'), {
            token: owner.token,
            body: {name: `Providers ${RUN}`},
        });
        assert.equal(createdHousehold.status, 201, JSON.stringify(createdHousehold.body));
        const householdId = createdHousehold.body.id;

        const createdMeter = await call('POST', meter('/api/v1/meters'), {
            token: owner.token,
            body: {
                householdId,
                type: 'ELECTRICITY',
                name: 'Providers meter',
                serialNumber: `E2E-PROV-${RUN}`,
                unit: 'KWH',
            },
        });
        assert.equal(createdMeter.status, 201, JSON.stringify(createdMeter.body));
        const meterId = createdMeter.body.id;

        const viewerInvite = await call('POST', household(`/api/v1/households/${householdId}/invites`), {
            token: owner.token,
            body: {role: 'VIEWER'},
        });
        assert.equal(viewerInvite.status, 201);
        const viewerJoined = await call('POST', household('/api/v1/households/invites/redeem'), {
            token: viewer.token,
            body: {code: viewerInvite.body.code},
            client: 5,
        });
        assert.equal(viewerJoined.status, 200);

        // Before any binding the meter has no provider windows — the
        // documented "no provider linked" empty state.
        const windowsBefore = await call('GET', provider(`/api/v1/submission-windows?meterId=${meterId}`), {
            token: owner.token,
        });
        assert.equal(windowsBefore.status, 200);
        assert.deepEqual(windowsBefore.body, {});

        // --- Account creation ---
        const viewerAccount = await call('POST', provider('/api/v1/provider-accounts'), {
            token: viewer.token,
            body: {providerId, householdId, label: 'Viewer tried it'},
        });
        assert.equal(viewerAccount.status, 403);
        assert.equal(viewerAccount.body.code, 'FORBIDDEN_ROLE');

        const accountEventsBefore = await endOffset('provider.account.changed');
        const createdAccount = await call('POST', provider('/api/v1/provider-accounts'), {
            token: owner.token,
            body: {providerId, householdId, label: 'Flat 12', accountNumber: `E2E-${RUN}`},
        });
        assert.equal(createdAccount.status, 201, JSON.stringify(createdAccount.body));
        // The provider's default window is copied when the account omits its own.
        assert.deepEqual(createdAccount.body.rule, rule);
        const accountId = createdAccount.body.id;

        // --- Binding ---
        const today = new Date().toISOString().slice(0, 10);
        const bindingEventsBefore = await endOffset('provider.binding.changed');
        const createdBinding = await call('POST', provider('/api/v1/meter-bindings'), {
            token: owner.token,
            body: {accountId, meterId},
        });
        assert.equal(createdBinding.status, 201, JSON.stringify(createdBinding.body));
        assert.equal(createdBinding.body.accountId, accountId);
        assert.equal(createdBinding.body.meterId, meterId);
        assert.equal(createdBinding.body.validFrom, today, 'validFrom defaults to today');
        assert.equal(createdBinding.body.validTo, null);
        const bindingId = createdBinding.body.id;

        // An overlapping binding for the same meter is rejected.
        const secondAccount = await call('POST', provider('/api/v1/provider-accounts'), {
            token: owner.token,
            body: {providerId, householdId, label: 'Backup tariff'},
        });
        assert.equal(secondAccount.status, 201);
        const overlapping = await call('POST', provider('/api/v1/meter-bindings'), {
            token: owner.token,
            body: {accountId: secondAccount.body.id, meterId},
        });
        assert.equal(overlapping.status, 409);
        assert.equal(overlapping.body.code, 'METER_ALREADY_BOUND');

        // --- Submission windows answer through the gateway ---
        const windows = await call('GET', provider(`/api/v1/submission-windows?meterId=${meterId}`), {
            token: owner.token,
        });
        assert.equal(windows.status, 200);
        assert.equal(windows.body.binding.id, bindingId);
        // The rule opens on day 5 and closes on day 20; at test time either
        // the day-5..20 window is current, or the next one is upcoming.
        assert.ok(windows.body.current || windows.body.next, 'a window is resolved');
        const resolved = windows.body.current ?? windows.body.next;
        assert.equal(resolved.accountId, accountId);
        assert.equal(resolved.providerId, providerId);
        assert.match(resolved.opensAt, /^\d{4}-\d{2}-\d{2}T/);
        assert.match(resolved.closesAt, /^\d{4}-\d{2}-\d{2}T/);
        assert.ok(resolved.closesAt > resolved.opensAt, 'window closes after it opens');

        // Viewer may read windows but not bind.
        const viewerWindows = await call('GET', provider(`/api/v1/submission-windows?meterId=${meterId}`), {
            token: viewer.token,
        });
        assert.equal(viewerWindows.status, 200);
        const viewerBinding = await call('POST', provider('/api/v1/meter-bindings'), {
            token: viewer.token,
            body: {accountId, meterId, validFrom: '2030-01-01'},
        });
        assert.equal(viewerBinding.status, 403);
        assert.equal(viewerBinding.body.code, 'FORBIDDEN_ROLE');

        // --- Admin without membership is reported 404, never 403 ---
        // (same no-enumeration rule as the household service: the admin
        // role does not pierce household walls)
        const adminAccounts = await call(
            'GET',
            provider(`/api/v1/provider-accounts?householdId=${householdId}`),
            {token: admin.token, client: 3},
        );
        assert.equal(adminAccounts.status, 404);
        assert.equal(adminAccounts.body.code, 'HOUSEHOLD_NOT_FOUND');

        const adminBind = await call('POST', provider('/api/v1/meter-bindings'), {
            token: admin.token,
            body: {accountId, meterId},
            client: 3,
        });
        assert.equal(adminBind.status, 404, 'non-member admin cannot see the account to bind');
        assert.equal(adminBind.body.code, 'PROVIDER_ACCOUNT_NOT_FOUND');

        // --- Supplier switch: end the binding, rebind to the second account ---
        const ended = await call('PATCH', provider(`/api/v1/meter-bindings/${bindingId}`), {
            token: owner.token,
            body: {validTo: today},
        });
        assert.equal(ended.status, 200, JSON.stringify(ended.body));
        assert.equal(ended.body.validTo, today);
        assert.equal(ended.body.version, 2, 'ending bumps the snapshot version');

        // Binding periods are inclusive on both ends, so the replacement
        // starts the day after the old binding's end date.
        const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
        const rebind = await call('POST', provider('/api/v1/meter-bindings'), {
            token: owner.token,
            body: {accountId: secondAccount.body.id, meterId, validFrom: tomorrow},
        });
        assert.equal(rebind.status, 201, JSON.stringify(rebind.body));
        assert.equal(rebind.body.accountId, secondAccount.body.id);

        const windowsAfter = await call('GET', provider(`/api/v1/submission-windows?meterId=${meterId}`), {
            token: owner.token,
        });
        assert.equal(windowsAfter.status, 200);
        // Inclusive closing: the ended binding still covers the meter through
        // today; the new one takes over tomorrow.
        assert.equal(windowsAfter.body.binding.id, bindingId);

        const bindings = await call('GET', provider(`/api/v1/meter-bindings?meterId=${meterId}`), {
            token: owner.token,
        });
        assert.equal(bindings.status, 200);
        assert.equal(bindings.body.length, 2, 'supplier switch keeps both binding rows');
        assert.ok(bindings.body.some((b) => b.id === bindingId && b.validTo === today));
        assert.ok(bindings.body.some((b) => b.id === rebind.body.id && b.validTo === null));

        // --- Events on Kafka ---
        const accountEvents = await consumeAfter({
            topic: 'provider.account.changed',
            afterOffset: accountEventsBefore,
            max: 2,
            timeoutMs: 30_000,
        });
        assert.ok(accountEvents.length >= 2, 'both account creations were published');
        for (const event of accountEvents) {
            assert.ok(
                validateAccountEvent(event.value),
                `account event matches v1 schema: ${JSON.stringify(validateAccountEvent.errors)}`,
            );
            assert.equal(event.value.producer, 'provider-service');
        }
        const firstEvent = accountEvents.find((e) => e.value.data.accountId === accountId);
        assert.ok(firstEvent, 'first account has a snapshot event');
        assert.equal(firstEvent.value.data.version, 1);
        assert.deepEqual(firstEvent.value.data.rule, rule);
        assert.equal(firstEvent.value.data.archived, false);

        const bindingEvents = await consumeAfter({
            topic: 'provider.binding.changed',
            afterOffset: bindingEventsBefore,
            max: 3,
            timeoutMs: 30_000,
        });
        assert.ok(bindingEvents.length >= 3, 'bind, end and rebind published (the overlap rejection did not)');
        for (const event of bindingEvents) {
            assert.ok(
                validateBindingEvent(event.value),
                `binding event matches v1 schema: ${JSON.stringify(validateBindingEvent.errors)}`,
            );
            assert.equal(event.value.data.meterId, meterId, 'binding events all belong to the test meter');
        }
        // The stream holds the binding's create and end snapshots; the end
        // is the one carrying the bumped version.
        const endedEvent = bindingEvents.find((e) => e.value.data.bindingId === bindingId && e.value.data.version === 2);
        assert.ok(endedEvent, 'the ended binding has a snapshot event');
        assert.equal(endedEvent.value.data.validTo, today);
        const reboundEvent = bindingEvents.find((e) => e.value.data.bindingId === rebind.body.id);
        assert.ok(reboundEvent, 'the rebind has a snapshot event');
        assert.equal(reboundEvent.value.data.validTo, null);
    } finally {
        undoAdmin();
        // Reconcile the demotion immediately so later runs don't see a stale
        // ADMIN; the declared list is back to its original content. The wait
        // matters: the other suites run after this file and would otherwise
        // register users against a still-booting identity-service.
        composeExec('up -d --force-recreate --no-deps identity-service');
        await awaitIdentityReady();
    }
});
