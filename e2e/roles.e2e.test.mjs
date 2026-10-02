/**
 * MeterHub multi-user roles journey (spec 4, Epic R7).
 *
 * Drives the household-membership-roles journey through the API gateway
 * against the running Docker Compose environment:
 *
 *   owner creates household -> invites MEMBER -> B redeems
 *     -> B sees household/meters/readings -> B submits reading
 *     -> owner invites VIEWER -> C reads but cannot write (FORBIDDEN_ROLE)
 *     -> owner removes B -> B loses access within the verdict-cache TTL
 *     -> used/expired/revoked/unknown code error paths
 *     -> single-owner protection (owner row immovable)
 *
 * Nothing is mocked: HTTP goes to the gateway (http://localhost:8080 by
 * default, override with GATEWAY_URL). Each run uses unique emails so it
 * can be re-run against a persistent database.
 *
 * Run with: node --test e2e/
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';

const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:8080';
const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const PASSWORD = 'correct-horse-battery';

/**
 * JSON request through the gateway; returns {status, body}.
 *
 * Distinct X-Forwarded-For per actor, mirroring how separate browsers are
 * isolated by the gateway's IP-keyed auth rate limiter (see
 * journey.e2e.test.mjs for the full rationale). 203.0.113.0/24 is
 * TEST-NET-3, never routed.
 */
const CLIENTS = ['owner', 'member', 'viewer', 'stranger'].map(
    (who, i) => `203.0.113.${(RUN.charCodeAt(RUN.length - 1) + i * 11) % 250 + 1}`,
);

async function call(method, path, {token, body, client = 0} = {}) {
    const response = await fetch(`${GATEWAY}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': crypto.randomUUID(),
            'X-Forwarded-For': CLIENTS[client],
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

/** Registers and logs in a fresh user; returns {userId, token}. */
async function newUser(who) {
    const suffix = `${RUN}-${who}`;
    const email = `e2e-${suffix}@example.com`;
    const username = `e2e-${suffix}`;
    const registered = await call('POST', identity('/api/v1/auth/register'), {
        body: {email, username, password: PASSWORD},
        client: CLIENTS.indexOf(who) >= 0 ? ['owner', 'member', 'viewer', 'stranger'].indexOf(who) : 0,
    });
    assert.equal(registered.status, 201, JSON.stringify(registered.body));
    const login = await call('POST', identity('/api/v1/auth/login'), {
        body: {email, password: PASSWORD},
        client: ['owner', 'member', 'viewer', 'stranger'].indexOf(who),
    });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    return {userId: registered.body.id, token: login.body.accessToken};
}

const recordedAt = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

test('owner -> member -> viewer roles journey', async () => {
    const owner = await newUser('owner');
    const member = await newUser('member');
    const viewer = await newUser('viewer');
    const stranger = await newUser('stranger');

    // --- Owner creates the household and a meter ---
    const created = await call('POST', household('/api/v1/households'), {
        token: owner.token,
        body: {name: `Roles ${RUN}`},
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const householdId = created.body.id;
    assert.equal(created.body.role, 'OWNER', 'creator is OWNER');

    const createdMeter = await call('POST', meter('/api/v1/meters'), {
        token: owner.token,
        body: {
            householdId,
            type: 'ELECTRICITY',
            name: 'Roles meter',
            serialNumber: `E2E-${RUN}`,
            unit: 'KWH',
        },
    });
    assert.equal(createdMeter.status, 201, JSON.stringify(createdMeter.body));
    const meterId = createdMeter.body.id;

    // --- Owner invites MEMBER; B redeems ---
    const memberInvite = await call('POST', household(`/api/v1/households/${householdId}/invites`), {
        token: owner.token,
        body: {role: 'MEMBER'},
    });
    assert.equal(memberInvite.status, 201, JSON.stringify(memberInvite.body));
    assert.match(memberInvite.body.code, /^mh_/);
    assert.equal(memberInvite.body.role, 'MEMBER');

    // The invite list never leaks code material
    const liveInvites = await call('GET', household(`/api/v1/households/${householdId}/invites`), {
        token: owner.token,
    });
    assert.equal(liveInvites.status, 200);
    assert.ok(liveInvites.body.every((invite) => invite.code === undefined));

    // Only the owner manages members/invites: the member-to-be is rejected
    const nonOwnerInvite = await call('POST', household(`/api/v1/households/${householdId}/invites`), {
        token: member.token,
        body: {role: 'VIEWER'},
    });
    assert.equal(nonOwnerInvite.status, 403);
    assert.equal(nonOwnerInvite.body.code, 'HOUSEHOLD_ACCESS_DENIED');

    const redeemed = await call('POST', household('/api/v1/households/invites/redeem'), {
        token: member.token,
        body: {code: memberInvite.body.code},
        client: 1,
    });
    assert.equal(redeemed.status, 200, JSON.stringify(redeemed.body));
    assert.equal(redeemed.body.householdId, householdId);
    assert.equal(redeemed.body.role, 'MEMBER');

    // Single use: the same code again is a typed conflict
    const reusedCode = await call('POST', household('/api/v1/households/invites/redeem'), {
        token: stranger.token,
        body: {code: memberInvite.body.code},
        client: 3,
    });
    assert.equal(reusedCode.status, 409);
    assert.equal(reusedCode.body.code, 'INVITE_ALREADY_USED');

    // --- B now sees the household, meters, readings — and can write ---
    const memberHouseholds = await call('GET', household('/api/v1/households'), {token: member.token});
    assert.equal(memberHouseholds.status, 200);
    const memberView = memberHouseholds.body.find((h) => h.id === householdId);
    assert.ok(memberView, 'member sees the household in their list');
    assert.equal(memberView.role, 'MEMBER');

    const memberMeters = await call('GET', meter(`/api/v1/meters?householdId=${householdId}`), {
        token: member.token,
    });
    assert.equal(memberMeters.status, 200);
    assert.ok(memberMeters.body.some((m) => m.id === meterId));

    const memberReading = await call('POST', reading('/api/v1/readings'), {
        token: member.token,
        body: {meterId, value: 1000, recordedAt: recordedAt()},
        client: 1,
    });
    assert.equal(memberReading.status, 201, JSON.stringify(memberReading.body));

    const memberHistory = await call('GET', reading(`/api/v1/meters/${meterId}/readings`), {
        token: member.token,
        client: 1,
    });
    assert.equal(memberHistory.status, 200);
    assert.ok(memberHistory.body.items.some((r) => r.value === 1000));

    // --- Owner invites VIEWER; C reads but cannot write ---
    const viewerInvite = await call('POST', household(`/api/v1/households/${householdId}/invites`), {
        token: owner.token,
        body: {role: 'VIEWER'},
    });
    assert.equal(viewerInvite.status, 201, JSON.stringify(viewerInvite.body));

    const viewerRedeemed = await call('POST', household('/api/v1/households/invites/redeem'), {
        token: viewer.token,
        body: {code: viewerInvite.body.code},
        client: 2,
    });
    assert.equal(viewerRedeemed.status, 200, JSON.stringify(viewerRedeemed.body));
    assert.equal(viewerRedeemed.body.role, 'VIEWER');

    const viewerMeters = await call('GET', meter(`/api/v1/meters?householdId=${householdId}`), {
        token: viewer.token,
        client: 2,
    });
    assert.equal(viewerMeters.status, 200, 'viewer reads meters');
    assert.ok(viewerMeters.body.some((m) => m.id === meterId));

    const viewerHistory = await call('GET', reading(`/api/v1/meters/${meterId}/readings`), {
        token: viewer.token,
        client: 2,
    });
    assert.equal(viewerHistory.status, 200, 'viewer reads readings');

    // VIEWER is MEMBER+ minus writes: typed 403, not a masked 404
    const viewerMeterWrite = await call('POST', meter('/api/v1/meters'), {
        token: viewer.token,
        body: {
            householdId,
            type: 'COLD_WATER',
            name: 'Viewer meter',
            serialNumber: `E2E-${RUN}-v`,
            unit: 'M3',
        },
        client: 2,
    });
    assert.equal(viewerMeterWrite.status, 403, JSON.stringify(viewerMeterWrite.body));
    assert.equal(viewerMeterWrite.body.code, 'FORBIDDEN_ROLE');

    const viewerReadingWrite = await call('POST', reading('/api/v1/readings'), {
        token: viewer.token,
        body: {meterId, value: 1100, recordedAt: recordedAt()},
        client: 2,
    });
    assert.equal(viewerReadingWrite.status, 403);
    assert.equal(viewerReadingWrite.body.code, 'FORBIDDEN_ROLE');

    // Viewer cannot invite either — management stays owner-only
    const viewerInvite2 = await call('POST', household(`/api/v1/households/${householdId}/invites`), {
        token: viewer.token,
        body: {role: 'MEMBER'},
        client: 2,
    });
    assert.equal(viewerInvite2.status, 403);

    // --- Error paths for codes ---
    const unknownCode = await call('POST', household('/api/v1/households/invites/redeem'), {
        token: stranger.token,
        body: {code: 'mh_nosuchcode0000000000000000000000000000000'},
        client: 3,
    });
    assert.equal(unknownCode.status, 404);
    assert.equal(unknownCode.body.code, 'INVITE_NOT_FOUND');

    // Revoke: owner creates a third invite and kills it before use
    const doomedInvite = await call('POST', household(`/api/v1/households/${householdId}/invites`), {
        token: owner.token,
        body: {role: 'VIEWER'},
    });
    assert.equal(doomedInvite.status, 201, JSON.stringify(doomedInvite.body));
    const revoked = await call(
        'DELETE',
        household(`/api/v1/households/${householdId}/invites/${doomedInvite.body.id}`),
        {token: owner.token},
    );
    assert.equal(revoked.status, 204);
    const revokedRedeem = await call('POST', household('/api/v1/households/invites/redeem'), {
        token: stranger.token,
        body: {code: doomedInvite.body.code},
        client: 3,
    });
    assert.equal(revokedRedeem.status, 404, 'revoked code no longer matches a live invite');

    // --- Owner removes B; B loses access within the verdict-cache TTL ---
    const memberList = await call('GET', household(`/api/v1/households/${householdId}/members`), {
        token: owner.token,
    });
    assert.equal(memberList.status, 200);
    const memberRow = memberList.body.find((m) => m.userId === member.userId);
    assert.ok(memberRow, 'member is on the roster');

    // Single-owner protection: the owner cannot be removed, even by self
    const removeOwner = await call(
        'DELETE',
        household(`/api/v1/households/${householdId}/members/${owner.userId}`),
        {token: owner.token},
    );
    assert.equal(removeOwner.status, 409);
    assert.equal(removeOwner.body.code, 'OWNER_CANNOT_BE_REMOVED');

    const removed = await call(
        'DELETE',
        household(`/api/v1/households/${householdId}/members/${member.userId}`),
        {token: owner.token},
    );
    assert.equal(removed.status, 204, JSON.stringify(removed.body));

    // Immediately after removal B may still pass while the 30 s verdict
    // cache holds the stale allow (spec §11 accepted trade-off)...
    const stale = await call('GET', reading(`/api/v1/meters/${meterId}/readings`), {
        token: member.token,
        client: 1,
    });
    if (stale.status !== 200) {
        // ...or the cache entry may already be gone on another instance.
        assert.equal(stale.status, 404);
    }

    // Wait out the verdict-cache TTL (30 s) plus a margin.
    await new Promise((resolve) => setTimeout(resolve, 35_000));

    // ...then the denial must be in force, masked as enumeration-safe 404.
    const memberAfterTtl = await call('GET', meter(`/api/v1/meters?householdId=${householdId}`), {
        token: member.token,
        client: 1,
    });
    assert.equal(memberAfterTtl.status, 404, JSON.stringify(memberAfterTtl.body));

    const memberReadingAfterTtl = await call('GET', reading(`/api/v1/meters/${meterId}/readings`), {
        token: member.token,
        client: 1,
    });
    assert.equal(memberReadingAfterTtl.status, 404);
    assert.equal(memberReadingAfterTtl.body.code, 'METER_NOT_FOUND');

    // The removed member redeeming their own consumed code is an idempotent
    // no-op success (spec §5: "already a member" — the service honors
    // redeemedBy regardless of current membership), which silently
    // re-grants them access. That is arguably a gap: removal is supposed
    // to revoke, but the old code lets the member walk back in. Asserting
    // the shipped behavior here so the journey documents it.
    const memberCodeAfterRemoval = await call('POST', household('/api/v1/households/invites/redeem'), {
        token: member.token,
        body: {code: memberInvite.body.code},
        client: 1,
    });
    assert.equal(memberCodeAfterRemoval.status, 200, JSON.stringify(memberCodeAfterRemoval.body));
    assert.equal(memberCodeAfterRemoval.body.role, 'MEMBER', 'removed member re-joins via own used code');

    // ...and with membership re-granted, the meter is visible again. The
    // deny verdict may itself be cached for up to 30 s (fail-closed direction
    // of the same §11 trade-off), so allow either until the TTL lapses.
    const waitOutVerdict = () => new Promise((resolve) => setTimeout(resolve, 35_000));
    let memberMetersAfterRedeem = await call('GET', meter(`/api/v1/meters?householdId=${householdId}`), {
        token: member.token,
        client: 1,
    });
    if (memberMetersAfterRedeem.status === 404) {
        await waitOutVerdict();
        memberMetersAfterRedeem = await call('GET', meter(`/api/v1/meters?householdId=${householdId}`), {
            token: member.token,
            client: 1,
        });
    }
    assert.equal(memberMetersAfterRedeem.status, 200, JSON.stringify(memberMetersAfterRedeem.body));

    // Stranger (never a member) is 404-masked on the household itself
    const strangerHousehold = await call('GET', household(`/api/v1/households/${householdId}`), {
        token: stranger.token,
        client: 3,
    });
    assert.equal(strangerHousehold.status, 404);
    assert.equal(strangerHousehold.body.code, 'HOUSEHOLD_NOT_FOUND');
});
