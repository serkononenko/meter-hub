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
    forgetMeters,
    grantRole,
    mintToken,
    registerMeter,
    revokeMembership,
} from './global-setup.js';

const VIEWER = '33333333-3333-4333-8333-333333333333';
const MEMBER = '44444444-4444-4444-8444-444444444444';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';

const RULE = {
    cycle: 'MONTHLY',
    opens: {kind: 'DAY_OF_MONTH', day: 20},
    closes: {kind: 'LAST_DAY', offsetDays: 0},
    timezone: 'Europe/Kyiv',
};
const OTHER_RULE = {...RULE, opens: {kind: 'DAY_OF_MONTH', day: 15}};

describe('Provider accounts (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let server: ReturnType<INestApplication['getHttpServer']>;

    const as = (subject: string, roles: string[] = ['USER']) => `Bearer ${mintToken({subject, roles})}`;
    const admin = () => as(ADMIN, ['USER', 'ADMIN']);

    beforeAll(async () => {
        app = (await Test.createTestingModule({imports: [AppModule]}).compile()).createNestApplication();
        await app.init();
        server = app.getHttpServer();
        prisma = app.get(PrismaService);
    });

    afterEach(async () => {
        await prisma.meterBinding.deleteMany();
        await prisma.providerAccount.deleteMany();
        await prisma.provider.deleteMany();
        revokeMembership(ALICE_HOUSEHOLD, VIEWER);
        revokeMembership(ALICE_HOUSEHOLD, MEMBER);
        forgetMeters();
        app.get(VerdictCache).clear();
    });

    afterAll(async () => {
        await app.close();
    });

    async function catalogProvider(name = 'Energy Co', defaultRule?: object) {
        const res = await request(server).post('/api/v1/providers').set('Authorization', admin())
            .send({scope: 'GLOBAL', name, ...(defaultRule ? {defaultRule} : {})});
        return res.body;
    }

    async function privateProvider(subject: string, householdId: string, name = 'My Utility') {
        const res = await request(server).post('/api/v1/providers').set('Authorization', as(subject))
            .send({scope: 'HOUSEHOLD', householdId, name});
        return res.body;
    }

    const createAccount = (subject: string, body: object) => request(server)
        .post('/api/v1/provider-accounts').set('Authorization', as(subject)).send(body);

    async function account(overrides: object = {}) {
        const provider = await catalogProvider();
        const res = await createAccount(ALICE, {
            providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: 'Electricity', rule: RULE, ...overrides,
        });
        return {provider, body: res.body, status: res.status};
    }

    describe('create', () => {
        it('creates an account from a catalog provider, recording who made it', async () => {
            const {body, status, provider} = await account({accountNumber: ' 0012345678 '});

            expect(status).toBe(201);
            expect(body).toMatchObject({
                providerId: provider.id,
                householdId: ALICE_HOUSEHOLD,
                label: 'Electricity',
                accountNumber: '0012345678',
                rule: RULE,
                version: 1,
                archived: false,
            });
            const row = await prisma.providerAccount.findUniqueOrThrow({where: {id: body.id}});
            expect(row.createdBy).toBe(ALICE);
        });

        it('copies the provider\'s default window when no rule is given', async () => {
            const provider = await catalogProvider('Water Co', OTHER_RULE);

            const res = await createAccount(ALICE, {providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: 'Water'});

            expect(res.status).toBe(201);
            expect(res.body.rule).toEqual(OTHER_RULE);
        });

        it('keeps the account\'s window when the provider\'s default changes later', async () => {
            const provider = await catalogProvider('Water Co', OTHER_RULE);
            const created = (await createAccount(ALICE, {
                providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: 'Water',
            })).body;

            await request(server).patch(`/api/v1/providers/${provider.id}`).set('Authorization', admin())
                .send({defaultRule: {...RULE, opens: {kind: 'DAY_OF_MONTH', day: 1}, closes: {kind: 'DAY_OF_MONTH', day: 10}}});

            const after = await request(server).get(`/api/v1/provider-accounts/${created.id}`).set('Authorization', as(ALICE));
            expect(after.body.rule).toEqual(OTHER_RULE);
            expect(after.body.version).toBe(1);
        });

        it('rejects an account with neither a rule nor a provider default', async () => {
            const provider = await catalogProvider('No Default Co');

            const res = await createAccount(ALICE, {providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: 'X'});

            expect(res.status).toBe(422);
            expect(res.body.code).toBe('INVALID_SUBMISSION_RULE');
        });

        it('rejects an invalid explicit rule', async () => {
            const provider = await catalogProvider();

            const res = await createAccount(ALICE, {
                providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: 'X',
                rule: {...RULE, opens: {kind: 'DAY_OF_MONTH', day: 5}, closes: {kind: 'DAY_OF_MONTH', day: 4}},
            });

            expect(res.status).toBe(422);
            expect(res.body.code).toBe('INVALID_SUBMISSION_RULE');
        });

        it('accepts a household\'s own private provider but not another household\'s', async () => {
            const mine = await privateProvider(ALICE, ALICE_HOUSEHOLD);
            const bobs = await privateProvider(BOB, BOB_HOUSEHOLD, 'Bob Utility');

            const own = await createAccount(ALICE, {providerId: mine.id, householdId: ALICE_HOUSEHOLD, label: 'A', rule: RULE});
            const foreign = await createAccount(ALICE, {providerId: bobs.id, householdId: ALICE_HOUSEHOLD, label: 'B', rule: RULE});
            const missing = await createAccount(ALICE, {providerId: UNKNOWN, householdId: ALICE_HOUSEHOLD, label: 'C', rule: RULE});

            expect(own.status).toBe(201);
            expect(foreign.status).toBe(404);
            expect(foreign.body.code).toBe('PROVIDER_NOT_FOUND');
            expect(missing.status).toBe(404);
            expect(foreign.body.detail).toBe(missing.body.detail);
        });

        it('refuses an archived provider with PROVIDER_ARCHIVED', async () => {
            const provider = await catalogProvider();
            await request(server).patch(`/api/v1/providers/${provider.id}`).set('Authorization', admin()).send({archived: true});

            const res = await createAccount(ALICE, {providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: 'X', rule: RULE});

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('PROVIDER_ARCHIVED');
        });

        it('follows household roles: a MEMBER creates, a VIEWER is forbidden, a non-member sees no household', async () => {
            grantRole(ALICE_HOUSEHOLD, MEMBER, 'MEMBER');
            grantRole(ALICE_HOUSEHOLD, VIEWER, 'VIEWER');
            const provider = await catalogProvider();
            const body = {providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: 'X', rule: RULE};

            expect((await createAccount(MEMBER, body)).status).toBe(201);
            const viewer = await createAccount(VIEWER, body);
            expect(viewer.status).toBe(403);
            expect(viewer.body.code).toBe('FORBIDDEN_ROLE');
            const outsider = await createAccount(BOB, body);
            expect(outsider.status).toBe(404);
            expect(outsider.body.code).toBe('HOUSEHOLD_NOT_FOUND');
        });

        it('gives an ADMIN no way into a household they do not belong to', async () => {
            const provider = await catalogProvider();

            const res = await request(server).post('/api/v1/provider-accounts').set('Authorization', admin())
                .send({providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: 'X', rule: RULE});

            expect(res.status).toBe(404);
            expect(res.body.code).toBe('HOUSEHOLD_NOT_FOUND');
        });

        it('validates the body', async () => {
            const provider = await catalogProvider();

            const blank = await createAccount(ALICE, {providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: '  ', rule: RULE});
            const badId = await createAccount(ALICE, {providerId: 'nope', householdId: ALICE_HOUSEHOLD, label: 'X', rule: RULE});

            expect(blank.status).toBe(400);
            expect(badId.status).toBe(400);
        });
    });

    describe('read', () => {
        it('lists a household\'s accounts, narrowed by provider and hiding archived ones', async () => {
            const first = await account({label: 'Electricity'});
            const gas = await catalogProvider('Gas Co');
            const second = (await createAccount(ALICE, {providerId: gas.id, householdId: ALICE_HOUSEHOLD, label: 'Gas', rule: RULE})).body;
            await request(server).patch(`/api/v1/provider-accounts/${second.id}`).set('Authorization', as(ALICE)).send({archived: true});

            const live = await request(server).get(`/api/v1/provider-accounts?householdId=${ALICE_HOUSEHOLD}`).set('Authorization', as(ALICE));
            const all = await request(server)
                .get(`/api/v1/provider-accounts?householdId=${ALICE_HOUSEHOLD}&includeArchived=true`).set('Authorization', as(ALICE));
            const byProvider = await request(server)
                .get(`/api/v1/provider-accounts?householdId=${ALICE_HOUSEHOLD}&providerId=${gas.id}&includeArchived=true`)
                .set('Authorization', as(ALICE));

            expect(live.body.map((a: { label: string }) => a.label)).toEqual(['Electricity']);
            expect(all.body.map((a: { label: string }) => a.label)).toEqual(['Electricity', 'Gas']);
            expect(byProvider.body.map((a: { label: string }) => a.label)).toEqual(['Gas']);
            expect(first.status).toBe(201);
        });

        it('lets a VIEWER read but a non-member sees nothing', async () => {
            grantRole(ALICE_HOUSEHOLD, VIEWER, 'VIEWER');
            const {body} = await account();

            const viewer = await request(server).get(`/api/v1/provider-accounts/${body.id}`).set('Authorization', as(VIEWER));
            const outsider = await request(server).get(`/api/v1/provider-accounts/${body.id}`).set('Authorization', as(BOB));
            const missing = await request(server).get(`/api/v1/provider-accounts/${UNKNOWN}`).set('Authorization', as(BOB));
            const foreignList = await request(server).get(`/api/v1/provider-accounts?householdId=${ALICE_HOUSEHOLD}`).set('Authorization', as(BOB));

            expect(viewer.status).toBe(200);
            expect(outsider.status).toBe(404);
            expect(outsider.body.code).toBe('PROVIDER_ACCOUNT_NOT_FOUND');
            expect(outsider.body.detail).toBe(missing.body.detail);
            expect(foreignList.status).toBe(404);
            expect(foreignList.body.code).toBe('HOUSEHOLD_NOT_FOUND');
        });

        it('does not let an ADMIN read a household\'s accounts', async () => {
            const {body} = await account();

            const res = await request(server).get(`/api/v1/provider-accounts/${body.id}`).set('Authorization', admin());

            expect(res.status).toBe(404);
        });

        it('requires a householdId and rejects malformed identifiers with 400', async () => {
            const noHousehold = await request(server).get('/api/v1/provider-accounts').set('Authorization', as(ALICE));
            const badAccount = await request(server).get('/api/v1/provider-accounts/not-a-uuid').set('Authorization', as(ALICE));
            const badHousehold = await request(server).get('/api/v1/provider-accounts?householdId=nope').set('Authorization', as(ALICE));

            for (const res of [noHousehold, badAccount, badHousehold]) {
                expect(res.status).toBe(400);
                expect(res.body.code).toBe('VALIDATION_ERROR');
            }
        });
    });

    describe('update', () => {
        it('bumps version only when something actually changes', async () => {
            const {body} = await account();
            const patch = (payload: object) => request(server).patch(`/api/v1/provider-accounts/${body.id}`)
                .set('Authorization', as(ALICE)).send(payload);

            const relabelled = await patch({label: 'Main electricity'});
            const sameLabel = await patch({label: 'Main electricity'});
            const reorderedRule = await patch({rule: {timezone: RULE.timezone, closes: RULE.closes, opens: RULE.opens, cycle: 'MONTHLY'}});
            const newRule = await patch({rule: OTHER_RULE});

            expect(relabelled.body).toMatchObject({label: 'Main electricity', version: 2});
            expect(sameLabel.body.version).toBe(2);
            expect(reorderedRule.body.version).toBe(2);
            expect(newRule.body).toMatchObject({rule: OTHER_RULE, version: 3});
            const row = await prisma.providerAccount.findUniqueOrThrow({where: {id: body.id}});
            expect(row.updatedBy).toBe(ALICE);
        });

        it('re-points an account from a private duplicate to the catalog entry, leaving its bindings', async () => {
            const duplicate = await privateProvider(ALICE, ALICE_HOUSEHOLD, 'EnergyCo');
            const created = (await createAccount(ALICE, {
                providerId: duplicate.id, householdId: ALICE_HOUSEHOLD, label: 'Electricity', rule: RULE,
            })).body;
            const meterId = registerMeter('0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01', ALICE_HOUSEHOLD);
            const binding = (await request(server).post('/api/v1/meter-bindings').set('Authorization', as(ALICE))
                .send({accountId: created.id, meterId})).body;
            const catalog = await catalogProvider('Energy Co');

            const res = await request(server).patch(`/api/v1/provider-accounts/${created.id}`)
                .set('Authorization', as(ALICE)).send({providerId: catalog.id});

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({providerId: catalog.id, version: 2});
            const stillBound = await prisma.meterBinding.findUniqueOrThrow({where: {id: binding.id}});
            expect(stillBound.accountId).toBe(created.id);
        });

        it('refuses to re-point to another household\'s private provider or an archived one', async () => {
            const {body} = await account();
            const bobs = await privateProvider(BOB, BOB_HOUSEHOLD);
            const archived = await catalogProvider('Old Co');
            await request(server).patch(`/api/v1/providers/${archived.id}`).set('Authorization', admin()).send({archived: true});
            const patch = (providerId: string) => request(server).patch(`/api/v1/provider-accounts/${body.id}`)
                .set('Authorization', as(ALICE)).send({providerId});

            const foreign = await patch(bobs.id);
            const old = await patch(archived.id);

            expect(foreign.status).toBe(404);
            expect(foreign.body.code).toBe('PROVIDER_NOT_FOUND');
            expect(old.status).toBe(409);
            expect(old.body.code).toBe('PROVIDER_ARCHIVED');
        });

        it('follows household roles for updates and treats an outsider as not finding the account', async () => {
            grantRole(ALICE_HOUSEHOLD, VIEWER, 'VIEWER');
            const {body} = await account();
            const patch = (subject: string) => request(server).patch(`/api/v1/provider-accounts/${body.id}`)
                .set('Authorization', as(subject)).send({label: 'Hijack'});

            const viewer = await patch(VIEWER);
            const outsider = await patch(BOB);

            expect(viewer.status).toBe(403);
            expect(viewer.body.code).toBe('FORBIDDEN_ROLE');
            expect(outsider.status).toBe(404);
            expect(outsider.body.code).toBe('PROVIDER_ACCOUNT_NOT_FOUND');
        });

        it('rejects an empty update and an invalid rule', async () => {
            const {body} = await account();
            const patch = (payload: object) => request(server).patch(`/api/v1/provider-accounts/${body.id}`)
                .set('Authorization', as(ALICE)).send(payload);

            expect((await patch({})).status).toBe(400);
            const bad = await patch({rule: {...RULE, timezone: 'Mars/Phobos'}});
            expect(bad.status).toBe(422);
            expect(bad.body.code).toBe('INVALID_SUBMISSION_RULE');
        });
    });

    describe('archive', () => {
        it('archives and restores an account', async () => {
            const {body} = await account();
            const patch = (payload: object) => request(server).patch(`/api/v1/provider-accounts/${body.id}`)
                .set('Authorization', as(ALICE)).send(payload);

            const archived = await patch({archived: true});
            const restored = await patch({archived: false});

            expect(archived.body).toMatchObject({archived: true, version: 2});
            expect(restored.body).toMatchObject({archived: false, version: 3});
        });

        it('refuses to archive an account while a binding is in effect, and allows it once ended', async () => {
            const {body} = await account();
            const meterId = registerMeter('0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01', ALICE_HOUSEHOLD);
            const binding = (await request(server).post('/api/v1/meter-bindings').set('Authorization', as(ALICE))
                .send({accountId: body.id, meterId})).body;
            const archive = () => request(server).patch(`/api/v1/provider-accounts/${body.id}`)
                .set('Authorization', as(ALICE)).send({archived: true});

            const blocked = await archive();
            await request(server).patch(`/api/v1/meter-bindings/${binding.id}`).set('Authorization', as(ALICE))
                .send({validTo: binding.validFrom});
            const farPast = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
            await prisma.meterBinding.update({where: {id: binding.id}, data: {validFrom: new Date(farPast), validTo: new Date(farPast)}});
            const allowed = await archive();

            expect(blocked.status).toBe(409);
            expect(blocked.body.code).toBe('ACCOUNT_HAS_ACTIVE_BINDINGS');
            expect(allowed.status).toBe(200);
            expect(allowed.body.archived).toBe(true);
        });
    });
});
