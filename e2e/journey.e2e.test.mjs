/**
 * MeterHub end-to-end journey test (task 9.4).
 *
 * Drives the full user journey through the API gateway against the running
 * Docker Compose environment:
 *
 *   register -> login -> create household -> create meter
 *     -> record reading -> read history / latest
 *
 * Nothing is mocked: HTTP goes to the gateway (http://localhost:8080 by
 * default, override with GATEWAY_URL), which routes to the real services
 * backed by the real PostgreSQL. Each run uses a unique email so it can be
 * re-run against a persistent database.
 *
 * Run with: node --test e2e/
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';

const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:8080';
const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const EMAIL = `e2e-${RUN}@example.com`;
const USERNAME = `e2e-${RUN}`;
const PASSWORD = 'correct-horse-battery';

/** JSON request through the gateway; returns {status, body, correlationId}. */
async function call(method, path, {token, body} = {}) {
    const response = await fetch(`${GATEWAY}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': crypto.randomUUID(),
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return {
        status: response.status,
        body: text ? JSON.parse(text) : null,
        correlationId: response.headers.get('X-Correlation-ID'),
    };
}

const identity = (path) => `/api/identity-service${path}`;
const household = (path) => `/api/household-service${path}`;
const meter = (path) => `/api/meter-service${path}`;
const reading = (path) => `/api/reading-service${path}`;

test('register -> login -> household -> meter -> reading -> history', async () => {
    // --- Registration ---
    const registered = await call('POST', identity('/api/v1/auth/register'), {
        body: {email: EMAIL, username: USERNAME, password: PASSWORD},
    });
    assert.equal(registered.status, 201, JSON.stringify(registered.body));
    assert.equal(registered.body.email, EMAIL);
    assert.equal(registered.body.status, 'ACTIVE');
    const userId = registered.body.id;
    assert.match(userId, /^[0-9a-f-]{36}$/);

    // Duplicate registration is a conflict with a typed problem
    const duplicate = await call('POST', identity('/api/v1/auth/register'), {
        body: {email: EMAIL, username: USERNAME, password: PASSWORD},
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, 'EMAIL_ALREADY_EXISTS');

    // --- Login ---
    const login = await call('POST', identity('/api/v1/auth/login'), {
        body: {email: EMAIL, password: PASSWORD},
    });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const {accessToken, refreshToken, tokenType, expiresIn, user} = login.body;
    assert.equal(tokenType, 'Bearer');
    assert.ok(accessToken.split('.').length === 3, 'access token is a JWT');
    assert.ok(refreshToken && refreshToken !== accessToken);
    assert.ok(expiresIn > 0);
    assert.equal(user.id, userId);

    // Wrong password is indistinguishable from unknown email
    const wrongPassword = await call('POST', identity('/api/v1/auth/login'), {
        body: {email: EMAIL, password: 'wrong-password'},
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongPassword.body.code, 'INVALID_CREDENTIALS');

    // --- Current user ---
    const me = await call('GET', identity('/api/v1/users/me'), {token: accessToken});
    assert.equal(me.status, 200);
    assert.equal(me.body.id, userId);
    assert.equal(me.body.email, EMAIL);

    // --- Household ---
    const createdHousehold = await call('POST', household('/api/v1/households'), {
        token: accessToken,
        body: {name: `E2E household ${RUN}`},
    });
    assert.equal(createdHousehold.status, 201, JSON.stringify(createdHousehold.body));
    const householdId = createdHousehold.body.id;
    assert.equal(createdHousehold.body.name, `E2E household ${RUN}`);

    const myHouseholds = await call('GET', household('/api/v1/households'), {token: accessToken});
    assert.equal(myHouseholds.status, 200);
    assert.ok(myHouseholds.body.some((h) => h.id === householdId));

    const fetchedHousehold = await call('GET', household(`/api/v1/households/${householdId}`), {
        token: accessToken,
    });
    assert.equal(fetchedHousehold.status, 200);
    assert.equal(fetchedHousehold.body.id, householdId);

    // --- Meter ---
    const createdMeter = await call('POST', meter('/api/v1/meters'), {
        token: accessToken,
        body: {
            householdId,
            type: 'ELECTRICITY',
            name: 'Main electricity meter',
            serialNumber: `E2E-${RUN}`,
            unit: 'KWH',
        },
    });
    assert.equal(createdMeter.status, 201, JSON.stringify(createdMeter.body));
    const meterId = createdMeter.body.id;
    assert.equal(createdMeter.body.householdId, householdId);
    assert.equal(createdMeter.body.status, 'ACTIVE');

    const myMeters = await call('GET', meter(`/api/v1/meters?householdId=${householdId}`), {
        token: accessToken,
    });
    assert.equal(myMeters.status, 200);
    assert.ok(myMeters.body.some((m) => m.id === meterId));

    // Same serial number again in the same household conflicts
    const duplicateMeter = await call('POST', meter('/api/v1/meters'), {
        token: accessToken,
        body: {
            householdId,
            type: 'ELECTRICITY',
            name: 'Duplicate',
            serialNumber: `E2E-${RUN}`,
            unit: 'KWH',
        },
    });
    assert.equal(duplicateMeter.status, 409);
    assert.equal(duplicateMeter.body.code, 'METER_SERIAL_NUMBER_CONFLICT');

    // --- Reading ---
    const recordedAt = (hoursAgo) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const firstReading = await call('POST', reading('/api/v1/readings'), {
        token: accessToken,
        body: {meterId, value: 1000, recordedAt: recordedAt(2)},
    });
    assert.equal(firstReading.status, 201, JSON.stringify(firstReading.body));
    assert.equal(firstReading.body.value, 1000);
    assert.equal(firstReading.body.source, 'MANUAL');

    const secondReading = await call('POST', reading('/api/v1/readings'), {
        token: accessToken,
        body: {meterId, value: 1050.5, recordedAt: recordedAt(1)},
    });
    assert.equal(secondReading.status, 201, JSON.stringify(secondReading.body));

    // Decreasing readings are rejected with a stable business error
    const decreasing = await call('POST', reading('/api/v1/readings'), {
        token: accessToken,
        body: {meterId, value: 900, recordedAt: recordedAt(0)},
    });
    assert.equal(decreasing.status, 422);
    assert.equal(decreasing.body.code, 'READING_DECREASING');

    // --- History ---
    const history = await call('GET', reading(`/api/v1/meters/${meterId}/readings?limit=10&offset=0`), {
        token: accessToken,
    });
    assert.equal(history.status, 200);
    assert.ok(Array.isArray(history.body));
    assert.ok(history.body.length >= 2, 'both readings are in history');
    // Newest first
    assert.equal(history.body[0].value, 1050.5);
    assert.equal(history.body[1].value, 1000);

    const latest = await call('GET', reading(`/api/v1/meters/${meterId}/readings/latest`), {
        token: accessToken,
    });
    assert.equal(latest.status, 200);
    assert.equal(latest.body.value, 1050.5);

    // --- Refresh token rotation ---
    const refreshed = await call('POST', identity('/api/v1/auth/refresh'), {
        body: {refreshToken},
    });
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
    assert.notEqual(refreshed.body.refreshToken, refreshToken, 'refresh token rotates');
    assert.ok(refreshed.body.accessToken);

    // The old refresh token is consumed — reuse fails identically to unknown
    const reused = await call('POST', identity('/api/v1/auth/refresh'), {
        body: {refreshToken},
    });
    assert.equal(reused.status, 401);
    assert.equal(reused.body.code, 'INVALID_REFRESH_TOKEN');

    // --- Logout revokes the new refresh token ---
    const logout = await call('POST', identity('/api/v1/auth/logout'), {
        body: {refreshToken: refreshed.body.refreshToken},
    });
    assert.equal(logout.status, 204);
    const afterLogout = await call('POST', identity('/api/v1/auth/refresh'), {
        body: {refreshToken: refreshed.body.refreshToken},
    });
    assert.equal(afterLogout.status, 401);
});

test('another user cannot see the journey user’s data', async () => {
    const suffix = (n) => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}-${n}`;

    // Two independent users; each owns one household.
    const createOwner = async (n) => {
        const email = `e2e-${suffix(n)}@example.com`;
        const username = `e2e-${suffix(n)}`;
        await call('POST', identity('/api/v1/auth/register'), {
            body: {email, username, password: PASSWORD},
        });
        const login = await call('POST', identity('/api/v1/auth/login'), {
            body: {email, password: PASSWORD},
        });
        assert.equal(login.status, 200);
        const token = login.body.accessToken;
        const created = await call('POST', household('/api/v1/households'), {
            token,
            body: {name: `Owner ${n}`},
        });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        return {token, householdId: created.body.id};
    };

    const ownerA = await createOwner('a');
    const ownerB = await createOwner('b');

    // A's household is invisible to B: same 404 as an unknown household
    const foreign = await call('GET', household(`/api/v1/households/${ownerA.householdId}`), {
        token: ownerB.token,
    });
    assert.equal(foreign.status, 404);
    assert.equal(foreign.body.code, 'HOUSEHOLD_NOT_FOUND');

    // A meter registered in A's household is invisible to B as well
    const aMeter = await call('POST', meter('/api/v1/meters'), {
        token: ownerA.token,
        body: {
            householdId: ownerA.householdId,
            type: 'GAS',
            name: 'Gas meter',
            serialNumber: `E2E-${suffix('m')}`,
            unit: 'M3',
        },
    });
    assert.equal(aMeter.status, 201, JSON.stringify(aMeter.body));

    const foreignMeterHistory = await call(
        'GET',
        reading(`/api/v1/meters/${aMeter.body.id}/readings`),
        {token: ownerB.token},
    );
    assert.equal(foreignMeterHistory.status, 404);
    assert.equal(foreignMeterHistory.body.code, 'METER_NOT_FOUND');

    const foreignReading = await call('POST', reading('/api/v1/readings'), {
        token: ownerB.token,
        body: {
            meterId: aMeter.body.id,
            value: 10,
            recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        },
    });
    assert.equal(foreignReading.status, 404);
    assert.equal(foreignReading.body.code, 'METER_NOT_FOUND');

    // B listing their own households sees only their own
    const bList = await call('GET', household('/api/v1/households'), {token: ownerB.token});
    assert.equal(bList.status, 200);
    assert.ok(bList.body.every((h) => h.id !== ownerA.householdId));
});
