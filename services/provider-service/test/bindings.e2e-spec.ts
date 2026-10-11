import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest';
import {AppModule} from '../src/app.module.js';
import {PrismaService} from '../src/database/prisma.service.js';
import {VerdictCache} from '../src/household/verdict-cache.js';
import {
    ADMIN,
    ALICE,
    ALICE_HOUSEHOLD,
    BOB,
    BOB_HOUSEHOLD,
    bringMeterBack,
    forgetMeters,
    grantRole,
    mintToken,
    registerMeter,
    revokeMembership,
    takeMeterDown,
} from './global-setup.js';

const VIEWER = '33333333-3333-4333-8333-333333333333';
const MEMBER = '44444444-4444-4444-8444-444444444444';
const METER = '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01';
const OTHER_METER = '1e8a9b37-7a7a-4b66-8b82-4ce22d1b2a12';
const BOBS_METER = '2f9bac48-8b8b-4c77-9c93-5df33e2c3b23';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';

const RULE = {
    cycle: 'MONTHLY',
    opens: {kind: 'DAY_OF_MONTH', day: 20},
    closes: {kind: 'LAST_DAY', offsetDays: 0},
    timezone: 'Europe/Kyiv',
};

describe('Meter bindings (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let server: ReturnType<INestApplication['getHttpServer']>;

    const as = (subject: string, roles: string[] = ['USER']) => `Bearer ${mintToken({subject, roles})}`;

    beforeAll(async () => {
        app = (await Test.createTestingModule({imports: [AppModule]}).compile()).createNestApplication();
        await app.init();
        server = app.getHttpServer();
        prisma = app.get(PrismaService);
    });

    afterEach(async () => {
        await prisma.providerOutbox.deleteMany();
        await prisma.meterBinding.deleteMany();
        await prisma.providerAccount.deleteMany();
        await prisma.provider.deleteMany();
        revokeMembership(ALICE_HOUSEHOLD, VIEWER);
        revokeMembership(ALICE_HOUSEHOLD, MEMBER);
        revokeMembership(BOB_HOUSEHOLD, ALICE);
        forgetMeters();
        app.get(VerdictCache).clear();
    });

    afterAll(async () => {
        await app.close();
    });

    async function newAccount(householdId = ALICE_HOUSEHOLD, owner = ALICE, label = 'Electricity') {
        const provider = (await request(server).post('/api/v1/providers').set('Authorization', as(ADMIN, ['USER', 'ADMIN']))
            .send({scope: 'GLOBAL', name: `Energy Co ${label}`})).body;
        const res = await request(server).post('/api/v1/provider-accounts').set('Authorization', as(owner))
            .send({providerId: provider.id, householdId, label, rule: RULE});
        return res.body as { id: string };
    }

    const bind = (subject: string, body: object) => request(server)
        .post('/api/v1/meter-bindings').set('Authorization', as(subject)).send(body);

    const end = (subject: string, bindingId: string, validTo: string) => request(server)
        .patch(`/api/v1/meter-bindings/${bindingId}`).set('Authorization', as(subject)).send({validTo});

    const openBindings = (meterId: string) => prisma.meterBinding.count({where: {meterId, validTo: null}});

    describe('create', () => {
        it('binds a meter, defaulting validFrom to today in the account\'s time zone', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const account = await newAccount();

            const res = await bind(ALICE, {accountId: account.id, meterId: METER});

            expect(res.status).toBe(201);
            const todayInKyiv = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Kyiv'}).format(new Date());
            expect(res.body).toMatchObject({
                accountId: account.id, householdId: ALICE_HOUSEHOLD, meterId: METER, validFrom: todayInKyiv, validTo: null, version: 1,
            });
            const row = await prisma.meterBinding.findUniqueOrThrow({where: {id: res.body.id}});
            expect(row.createdBy).toBe(ALICE);
        });

        it('honours an explicit validFrom', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const account = await newAccount();

            const res = await bind(ALICE, {accountId: account.id, meterId: METER, validFrom: '2026-01-15'});

            expect(res.status).toBe(201);
            expect(res.body.validFrom).toBe('2026-01-15');
        });

        it('rejects a meter that belongs to another household than the account with HOUSEHOLD_MISMATCH', async () => {
            grantRole(BOB_HOUSEHOLD, ALICE, 'MEMBER');
            registerMeter(BOBS_METER, BOB_HOUSEHOLD);
            const account = await newAccount();

            const res = await bind(ALICE, {accountId: account.id, meterId: BOBS_METER});

            expect(res.status).toBe(422);
            expect(res.body.code).toBe('HOUSEHOLD_MISMATCH');
            expect(await prisma.meterBinding.count()).toBe(0);
        });

        it('reports a meter the caller cannot see, or that does not exist, as METER_NOT_FOUND', async () => {
            registerMeter(BOBS_METER, BOB_HOUSEHOLD);
            const account = await newAccount();

            const invisible = await bind(ALICE, {accountId: account.id, meterId: BOBS_METER});
            const unknown = await bind(ALICE, {accountId: account.id, meterId: UNKNOWN});

            for (const res of [invisible, unknown]) {
                expect(res.status).toBe(422);
                expect(res.body.code).toBe('METER_NOT_FOUND');
            }
        });

        it('fails closed with 503 when the meter service is unreachable', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const account = await newAccount();
            await takeMeterDown();
            try {
                const res = await bind(ALICE, {accountId: account.id, meterId: METER});

                expect(res.status).toBe(503);
                expect(res.body.code).toBe('METER_SERVICE_UNAVAILABLE');
                expect(await prisma.meterBinding.count()).toBe(0);
            } finally {
                await bringMeterBack();
            }
        });

        it('follows household roles: MEMBER binds, VIEWER is forbidden, outsider finds no account, ADMIN gets nothing special', async () => {
            grantRole(ALICE_HOUSEHOLD, MEMBER, 'MEMBER');
            grantRole(ALICE_HOUSEHOLD, VIEWER, 'VIEWER');
            registerMeter(METER, ALICE_HOUSEHOLD);
            registerMeter(OTHER_METER, ALICE_HOUSEHOLD);
            const account = await newAccount();

            const member = await bind(MEMBER, {accountId: account.id, meterId: METER});
            const viewer = await bind(VIEWER, {accountId: account.id, meterId: OTHER_METER});
            const outsider = await bind(BOB, {accountId: account.id, meterId: OTHER_METER});
            const adminAttempt = await request(server).post('/api/v1/meter-bindings')
                .set('Authorization', as(ADMIN, ['USER', 'ADMIN'])).send({accountId: account.id, meterId: OTHER_METER});

            expect(member.status).toBe(201);
            expect(viewer.status).toBe(403);
            expect(viewer.body.code).toBe('FORBIDDEN_ROLE');
            expect(outsider.status).toBe(404);
            expect(outsider.body.code).toBe('PROVIDER_ACCOUNT_NOT_FOUND');
            expect(adminAttempt.status).toBe(404);
        });

        it('refuses to bind an archived account', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const account = await newAccount();
            await request(server).patch(`/api/v1/provider-accounts/${account.id}`).set('Authorization', as(ALICE)).send({archived: true});

            const res = await bind(ALICE, {accountId: account.id, meterId: METER});

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('ACCOUNT_ARCHIVED');
        });

        it('validates identifiers and dates', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const account = await newAccount();

            const badAccount = await bind(ALICE, {accountId: 'nope', meterId: METER});
            const badMeter = await bind(ALICE, {accountId: account.id, meterId: 'nope'});
            const notADate = await bind(ALICE, {accountId: account.id, meterId: METER, validFrom: '2026-02-30'});
            const wrongFormat = await bind(ALICE, {accountId: account.id, meterId: METER, validFrom: '15/01/2026'});

            for (const res of [badAccount, badMeter, notADate, wrongFormat]) {
                expect(res.status).toBe(400);
                expect(res.body.code).toBe('VALIDATION_ERROR');
            }
        });
    });

    describe('one binding per meter', () => {
        it('rejects a second open binding for the same meter, even on another account', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const first = await newAccount(ALICE_HOUSEHOLD, ALICE, 'Electricity');
            const second = await newAccount(ALICE_HOUSEHOLD, ALICE, 'Electricity (new supplier)');
            await bind(ALICE, {accountId: first.id, meterId: METER});

            const sameAccount = await bind(ALICE, {accountId: first.id, meterId: METER});
            const otherAccount = await bind(ALICE, {accountId: second.id, meterId: METER});

            for (const res of [sameAccount, otherAccount]) {
                expect(res.status).toBe(409);
                expect(res.body.code).toBe('METER_ALREADY_BOUND');
            }
            expect(await openBindings(METER)).toBe(1);
        });

        it('lets exactly one of 16 concurrent binds win, with no 500s and one open row', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const accounts = await Promise.all(Array.from({length: 4}, (_, i) => newAccount(ALICE_HOUSEHOLD, ALICE, `Account ${i}`)));

            const results = await Promise.all(Array.from({length: 16}, (_, i) =>
                bind(ALICE, {accountId: accounts[i % accounts.length].id, meterId: METER})));

            const statuses = results.map((res) => res.status);
            expect(statuses.filter((status) => status === 201)).toHaveLength(1);
            expect(statuses.filter((status) => status === 409)).toHaveLength(15);
            expect(results.filter((res) => res.status === 409).every((res) => res.body.code === 'METER_ALREADY_BOUND')).toBe(true);
            expect(await openBindings(METER)).toBe(1);
            expect(await prisma.meterBinding.count({where: {meterId: METER}})).toBe(1);
        });

        it('lets different meters bind to the same account at the same time', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            registerMeter(OTHER_METER, ALICE_HOUSEHOLD);
            const account = await newAccount();

            const results = await Promise.all([METER, OTHER_METER].map((meterId) => bind(ALICE, {accountId: account.id, meterId})));

            expect(results.map((res) => res.status)).toEqual([201, 201]);
        });

        it('rejects binding from a date before an earlier binding ends, and accepts the day after', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const first = await newAccount(ALICE_HOUSEHOLD, ALICE, 'Old supplier');
            const second = await newAccount(ALICE_HOUSEHOLD, ALICE, 'New supplier');
            const old = (await bind(ALICE, {accountId: first.id, meterId: METER, validFrom: '2026-01-01'})).body;
            expect((await end(ALICE, old.id, '2026-06-30')).status).toBe(200);

            const overlapping = await bind(ALICE, {accountId: second.id, meterId: METER, validFrom: '2026-06-30'});
            const dayAfter = await bind(ALICE, {accountId: second.id, meterId: METER, validFrom: '2026-07-01'});

            expect(overlapping.status).toBe(409);
            expect(overlapping.body.code).toBe('METER_ALREADY_BOUND');
            expect(dayAfter.status).toBe(201);
        });
    });

    describe('end', () => {
        it('ends a binding, bumps its version and keeps the row', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const account = await newAccount();
            const binding = (await bind(ALICE, {accountId: account.id, meterId: METER, validFrom: '2026-01-01'})).body;

            const res = await end(ALICE, binding.id, '2026-03-31');

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({id: binding.id, validTo: '2026-03-31', version: 2});
            const row = await prisma.meterBinding.findUniqueOrThrow({where: {id: binding.id}});
            expect(row.updatedBy).toBe(ALICE);
        });

        it('supports a supplier switch: end the old binding, bind the new account the next day, keep both rows', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const oldAccount = await newAccount(ALICE_HOUSEHOLD, ALICE, 'Old supplier');
            const newOne = await newAccount(ALICE_HOUSEHOLD, ALICE, 'New supplier');
            const old = (await bind(ALICE, {accountId: oldAccount.id, meterId: METER, validFrom: '2026-01-01'})).body;

            await end(ALICE, old.id, '2026-05-31');
            const switched = await bind(ALICE, {accountId: newOne.id, meterId: METER, validFrom: '2026-06-01'});

            expect(switched.status).toBe(201);
            const history = await request(server).get(`/api/v1/meter-bindings?meterId=${METER}`).set('Authorization', as(ALICE));
            expect(history.body.map((b: { accountId: string; validTo: string | null }) => [b.accountId, b.validTo]))
                .toEqual([[newOne.id, null], [oldAccount.id, '2026-05-31']]);
        });

        it('rejects an end date before the start, an already-ended binding and an unknown one', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const account = await newAccount();
            const binding = (await bind(ALICE, {accountId: account.id, meterId: METER, validFrom: '2026-03-01'})).body;

            const early = await end(ALICE, binding.id, '2026-02-28');
            await end(ALICE, binding.id, '2026-03-01');
            const again = await end(ALICE, binding.id, '2026-04-01');
            const unknown = await end(ALICE, UNKNOWN, '2026-04-01');
            const malformed = await end(ALICE, binding.id, '2026-13-01');

            expect(early.status).toBe(422);
            expect(early.body.code).toBe('INVALID_BINDING_PERIOD');
            expect(again.status).toBe(409);
            expect(again.body.code).toBe('BINDING_ALREADY_ENDED');
            expect(unknown.status).toBe(404);
            expect(unknown.body.code).toBe('METER_BINDING_NOT_FOUND');
            expect(malformed.status).toBe(400);
        });

        it('allows ending on the very day the binding started', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const account = await newAccount();
            const binding = (await bind(ALICE, {accountId: account.id, meterId: METER, validFrom: '2026-03-01'})).body;

            const res = await end(ALICE, binding.id, '2026-03-01');

            expect(res.status).toBe(200);
            expect(res.body.validTo).toBe('2026-03-01');
        });

        it('follows household roles when ending', async () => {
            grantRole(ALICE_HOUSEHOLD, VIEWER, 'VIEWER');
            registerMeter(METER, ALICE_HOUSEHOLD);
            const account = await newAccount();
            const binding = (await bind(ALICE, {accountId: account.id, meterId: METER})).body;

            const viewer = await end(VIEWER, binding.id, '2026-12-31');
            const outsider = await end(BOB, binding.id, '2026-12-31');

            expect(viewer.status).toBe(403);
            expect(viewer.body.code).toBe('FORBIDDEN_ROLE');
            expect(outsider.status).toBe(404);
            expect(outsider.body.code).toBe('METER_BINDING_NOT_FOUND');
            expect(await openBindings(METER)).toBe(1);
        });
    });

    describe('list', () => {
        it('lists an account\'s bindings and a meter\'s history for a VIEWER', async () => {
            grantRole(ALICE_HOUSEHOLD, VIEWER, 'VIEWER');
            registerMeter(METER, ALICE_HOUSEHOLD);
            const account = await newAccount();
            const binding = (await bind(ALICE, {accountId: account.id, meterId: METER})).body;

            const byAccount = await request(server).get(`/api/v1/meter-bindings?accountId=${account.id}`).set('Authorization', as(VIEWER));
            const byMeter = await request(server).get(`/api/v1/meter-bindings?meterId=${METER}`).set('Authorization', as(VIEWER));

            expect(byAccount.body.map((b: { id: string }) => b.id)).toEqual([binding.id]);
            expect(byMeter.body.map((b: { id: string }) => b.id)).toEqual([binding.id]);
        });

        it('requires exactly one filter and well-formed identifiers', async () => {
            const none = await request(server).get('/api/v1/meter-bindings').set('Authorization', as(ALICE));
            const both = await request(server).get(`/api/v1/meter-bindings?meterId=${METER}&accountId=${UNKNOWN}`).set('Authorization', as(ALICE));
            const malformed = await request(server).get('/api/v1/meter-bindings?meterId=nope').set('Authorization', as(ALICE));

            for (const res of [none, both, malformed]) {
                expect(res.status).toBe(400);
                expect(res.body.code).toBe('VALIDATION_ERROR');
            }
        });

        it('hides another household\'s account and meter history', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const account = await newAccount();
            await bind(ALICE, {accountId: account.id, meterId: METER});

            const accountOfAlice = await request(server).get(`/api/v1/meter-bindings?accountId=${account.id}`).set('Authorization', as(BOB));
            const missingAccount = await request(server).get(`/api/v1/meter-bindings?accountId=${UNKNOWN}`).set('Authorization', as(BOB));
            const meterOfAlice = await request(server).get(`/api/v1/meter-bindings?meterId=${METER}`).set('Authorization', as(BOB));

            expect(accountOfAlice.status).toBe(404);
            expect(accountOfAlice.body.detail).toBe(missingAccount.body.detail);
            expect(meterOfAlice.status).toBe(404);
            expect(meterOfAlice.body.code).toBe('METER_NOT_FOUND');
        });
    });
});
