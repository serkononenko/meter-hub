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
    forgetMeters,
    grantRole,
    mintToken,
    registerMeter,
    revokeMembership,
} from './global-setup.js';

const VIEWER = '33333333-3333-4333-8333-333333333333';
const METER = '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';

const RULE = {
    cycle: 'MONTHLY',
    opens: {kind: 'DAY_OF_MONTH', day: 20},
    closes: {kind: 'LAST_DAY', offsetDays: 0},
    timezone: 'Europe/Kyiv',
};

describe('Submission windows (e2e)', () => {
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
        forgetMeters();
        app.get(VerdictCache).clear();
    });

    afterAll(async () => {
        await app.close();
    });

    async function boundMeter(rule: object = RULE, validFrom = '2026-01-01') {
        registerMeter(METER, ALICE_HOUSEHOLD);
        const provider = (await request(server).post('/api/v1/providers').set('Authorization', as(ADMIN, ['USER', 'ADMIN']))
            .send({scope: 'GLOBAL', name: 'Energy Co'})).body;
        const account = (await request(server).post('/api/v1/provider-accounts').set('Authorization', as(ALICE))
            .send({providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: 'Electricity', rule})).body;
        const binding = (await request(server).post('/api/v1/meter-bindings').set('Authorization', as(ALICE))
            .send({accountId: account.id, meterId: METER, validFrom})).body;
        return {provider, account, binding};
    }

    const windows = (subject: string, query: string) => request(server)
        .get(`/api/v1/submission-windows?${query}`).set('Authorization', as(subject));

    describe('public endpoint', () => {
        it('reports the next window when none is open, and no current one', async () => {
            const {account, provider} = await boundMeter();

            const res = await windows(ALICE, `meterId=${METER}&at=2026-03-10T12:00:00Z`);

            expect(res.status).toBe(200);
            expect(res.body.current).toBeUndefined();
            expect(res.body.next).toEqual({
                opensAt: '2026-03-19T22:00:00.000Z',
                closesAt: '2026-03-31T21:00:00.000Z',
                accountId: account.id,
                providerId: provider.id,
            });
            expect(res.body.binding).toMatchObject({meterId: METER, accountId: account.id});
        });

        it('reports the open window as current, with the following one as next', async () => {
            await boundMeter();

            const res = await windows(ALICE, `meterId=${METER}&at=2026-03-25T12:00:00Z`);

            expect(res.body.current).toMatchObject({opensAt: '2026-03-19T22:00:00.000Z', closesAt: '2026-03-31T21:00:00.000Z'});
            expect(res.body.next).toMatchObject({opensAt: '2026-04-19T21:00:00.000Z'});
        });

        it('is inside the window the instant it opens and outside the instant it closes', async () => {
            await boundMeter();

            const opening = await windows(ALICE, `meterId=${METER}&at=2026-03-19T22:00:00Z`);
            const justBefore = await windows(ALICE, `meterId=${METER}&at=2026-03-19T21:59:59Z`);
            const lastInstant = await windows(ALICE, `meterId=${METER}&at=2026-03-31T20:59:59Z`);
            const closing = await windows(ALICE, `meterId=${METER}&at=2026-03-31T21:00:00Z`);

            expect(opening.body.current).toBeDefined();
            expect(justBefore.body.current).toBeUndefined();
            expect(lastInstant.body.current).toBeDefined();
            expect(closing.body.current).toBeUndefined();
        });

        it('defaults "at" to now', async () => {
            await boundMeter();

            const res = await windows(ALICE, `meterId=${METER}`);

            expect(res.status).toBe(200);
            expect(new Date(res.body.next.opensAt).getTime()).toBeGreaterThan(Date.now() - 31 * 86_400_000);
        });

        it('answers 200 with an empty object when the meter has no binding in force', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);

            const res = await windows(ALICE, `meterId=${METER}`);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({});
        });

        it('answers an empty object for a time before the binding began or after it ended', async () => {
            const {binding} = await boundMeter(RULE, '2026-03-01');
            await request(server).patch(`/api/v1/meter-bindings/${binding.id}`).set('Authorization', as(ALICE)).send({validTo: '2026-06-30'});

            const before = await windows(ALICE, `meterId=${METER}&at=2026-02-15T12:00:00Z`);
            const during = await windows(ALICE, `meterId=${METER}&at=2026-04-15T12:00:00Z`);
            const after = await windows(ALICE, `meterId=${METER}&at=2026-07-15T12:00:00Z`);

            expect(before.body).toEqual({});
            expect(during.body.next).toBeDefined();
            expect(after.body).toEqual({});
        });

        it('uses the account in force at that time after a supplier switch', async () => {
            const first = await boundMeter({...RULE, opens: {kind: 'DAY_OF_MONTH', day: 5}, closes: {kind: 'DAY_OF_MONTH', day: 10}}, '2026-01-01');
            await request(server).patch(`/api/v1/meter-bindings/${first.binding.id}`).set('Authorization', as(ALICE)).send({validTo: '2026-05-31'});
            const provider = (await request(server).post('/api/v1/providers').set('Authorization', as(ADMIN, ['USER', 'ADMIN']))
                .send({scope: 'GLOBAL', name: 'New Energy'})).body;
            const second = (await request(server).post('/api/v1/provider-accounts').set('Authorization', as(ALICE))
                .send({providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: 'New', rule: RULE})).body;
            await request(server).post('/api/v1/meter-bindings').set('Authorization', as(ALICE))
                .send({accountId: second.id, meterId: METER, validFrom: '2026-06-01'});

            const early = await windows(ALICE, `meterId=${METER}&at=2026-03-15T12:00:00Z`);
            const late = await windows(ALICE, `meterId=${METER}&at=2026-07-15T12:00:00Z`);

            expect(early.body.next.accountId).toBe(first.account.id);
            expect(late.body.next.accountId).toBe(second.id);
        });

        it('works out the binding day in the account\'s time zone, not UTC', async () => {
            await boundMeter(RULE, '2026-03-01');

            // 23:30 UTC on 28 Feb is already 1 March in Kyiv (UTC+2), so the binding has begun.
            const res = await windows(ALICE, `meterId=${METER}&at=2026-02-28T23:30:00Z`);

            expect(res.body.next).toBeDefined();
        });

        it('lets a VIEWER read, and hides the meter from a non-member and from an ADMIN', async () => {
            grantRole(ALICE_HOUSEHOLD, VIEWER, 'VIEWER');
            await boundMeter();

            const viewer = await windows(VIEWER, `meterId=${METER}`);
            const outsider = await windows(BOB, `meterId=${METER}`);
            const admin = await request(server).get(`/api/v1/submission-windows?meterId=${METER}`)
                .set('Authorization', as(ADMIN, ['USER', 'ADMIN']));
            const unknown = await windows(ALICE, `meterId=${UNKNOWN}`);

            expect(viewer.status).toBe(200);
            for (const res of [outsider, admin, unknown]) {
                expect(res.status).toBe(404);
                expect(res.body.code).toBe('METER_NOT_FOUND');
            }
        });

        it('rejects a missing or malformed meterId and a malformed "at"', async () => {
            const noMeter = await windows(ALICE, '');
            const badMeter = await windows(ALICE, 'meterId=nope');
            registerMeter(METER, ALICE_HOUSEHOLD);
            const badAt = await windows(ALICE, `meterId=${METER}&at=yesterday`);
            const dateOnly = await windows(ALICE, `meterId=${METER}&at=2026-03-10`);

            for (const res of [noMeter, badMeter, badAt, dateOnly]) {
                expect(res.status).toBe(400);
                expect(res.body.code).toBe('VALIDATION_ERROR');
            }
        });
    });

    describe('internal endpoint', () => {
        const internal = (query: string) => request(server).get(`/api/v1/internal/submission-windows?${query}`);

        it('lists the windows overlapping a range, oldest first, with no authentication', async () => {
            const {account, provider} = await boundMeter();

            const res = await internal(`accountId=${account.id}&from=2026-01-01T00:00:00Z&to=2026-04-01T00:00:00Z`);

            expect(res.status).toBe(200);
            expect(res.body.map((w: { opensAt: string }) => w.opensAt)).toEqual([
                '2026-01-19T22:00:00.000Z',
                '2026-02-19T22:00:00.000Z',
                '2026-03-19T22:00:00.000Z',
            ]);
            expect(res.body[0]).toMatchObject({accountId: account.id, providerId: provider.id});
        });

        it('includes a wrapping window that opened before the range began', async () => {
            const {account} = await boundMeter({...RULE, opens: {kind: 'DAY_OF_MONTH', day: 25}, closes: {kind: 'DAY_OF_MONTH', day: 5}});

            const res = await internal(`accountId=${account.id}&from=2026-02-01T00:00:00Z&to=2026-02-02T00:00:00Z`);

            expect(res.body).toHaveLength(1);
            expect(res.body[0].opensAt).toBe('2026-01-24T22:00:00.000Z');
        });

        it('treats the range as half-open: a window that closes exactly at "from" is excluded, one that opens at "to" too', async () => {
            const {account} = await boundMeter();

            const closesAtFrom = await internal(`accountId=${account.id}&from=2026-03-31T21:00:00Z&to=2026-04-10T00:00:00Z`);
            const opensAtTo = await internal(`accountId=${account.id}&from=2026-04-10T00:00:00Z&to=2026-04-19T21:00:00Z`);

            expect(closesAtFrom.body).toEqual([]);
            expect(opensAtTo.body).toEqual([]);
        });

        it('returns an empty list for a range with no window, 404 for an unknown account, and 400 for bad input', async () => {
            const {account} = await boundMeter();

            const quiet = await internal(`accountId=${account.id}&from=2026-03-01T00:00:00Z&to=2026-03-10T00:00:00Z`);
            const unknown = await internal(`accountId=${UNKNOWN}&from=2026-03-01T00:00:00Z&to=2026-03-10T00:00:00Z`);
            const reversed = await internal(`accountId=${account.id}&from=2026-03-10T00:00:00Z&to=2026-03-01T00:00:00Z`);
            const missing = await internal(`accountId=${account.id}&from=2026-03-01T00:00:00Z`);
            const badId = await internal('accountId=nope&from=2026-03-01T00:00:00Z&to=2026-03-10T00:00:00Z');

            expect(quiet.body).toEqual([]);
            expect(unknown.status).toBe(404);
            for (const res of [reversed, missing, badId]) {
                expect(res.status).toBe(400);
            }
        });
    });
});
