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
    grantRole,
    mintToken,
    revokeMembership,
} from './global-setup.js';

const VIEWER = '33333333-3333-4333-8333-333333333333';
const MEMBER = '44444444-4444-4444-8444-444444444444';

const RULE = {
    cycle: 'MONTHLY',
    opens: {kind: 'DAY_OF_MONTH', day: 20},
    closes: {kind: 'LAST_DAY', offsetDays: 0},
    timezone: 'Europe/Kyiv',
};

describe('Providers (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let server: ReturnType<INestApplication['getHttpServer']>;

    const as = (subject: string, roles: string[] = ['USER']) => `Bearer ${mintToken({subject, roles})}`;

    beforeAll(async () => {
        const moduleFixture = await Test.createTestingModule({imports: [AppModule]}).compile();
        app = moduleFixture.createNestApplication();
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
        app.get(VerdictCache).clear();
    });

    afterAll(async () => {
        await app.close();
    });

    const createGlobal = (name = 'Energy Co', body: object = {}) => request(server)
        .post('/api/v1/providers')
        .set('Authorization', as(ADMIN, ['USER', 'ADMIN']))
        .send({scope: 'GLOBAL', name, ...body});

    const createPrivate = (subject: string, householdId: string, name = 'My Utility') => request(server)
        .post('/api/v1/providers')
        .set('Authorization', as(subject))
        .send({scope: 'HOUSEHOLD', householdId, name});

    describe('catalog writes need the ADMIN system role', () => {
        it('lets an admin create a global provider with a default window', async () => {
            const res = await createGlobal('Energy Co', {defaultRule: RULE});

            expect(res.status).toBe(201);
            expect(res.body).toMatchObject({scope: 'GLOBAL', name: 'Energy Co', archived: false, defaultRule: RULE});
            expect(res.body.householdId).toBeNull();
        });

        it('rejects a non-admin with FORBIDDEN_SYSTEM_ROLE for create, update, archive and promote', async () => {
            const global = (await createGlobal()).body;
            const priv = (await createPrivate(ALICE, ALICE_HOUSEHOLD)).body;
            const user = as(ALICE);

            const create = await request(server).post('/api/v1/providers').set('Authorization', user)
                .send({scope: 'GLOBAL', name: 'Sneaky'});
            const rename = await request(server).patch(`/api/v1/providers/${global.id}`).set('Authorization', user)
                .send({name: 'Renamed'});
            const archive = await request(server).patch(`/api/v1/providers/${global.id}`).set('Authorization', user)
                .send({archived: true});
            const promote = await request(server).post(`/api/v1/providers/${priv.id}/promote`).set('Authorization', user);

            for (const res of [create, rename, archive, promote]) {
                expect(res.status).toBe(403);
                expect(res.body.code).toBe('FORBIDDEN_SYSTEM_ROLE');
            }
        });

        it('does not treat a household OWNER as a system admin', async () => {
            const res = await request(server).post('/api/v1/providers').set('Authorization', as(ALICE))
                .send({scope: 'GLOBAL', name: 'Owner tries the catalog'});

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN_SYSTEM_ROLE');
        });

        it('lets an admin rename and archive a global provider, and records who did it', async () => {
            const global = (await createGlobal()).body;

            const res = await request(server).patch(`/api/v1/providers/${global.id}`)
                .set('Authorization', as(ADMIN, ['USER', 'ADMIN']))
                .send({name: 'Energy Company', archived: true});

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({name: 'Energy Company', archived: true});
            const row = await prisma.provider.findUniqueOrThrow({where: {id: global.id}});
            expect(row.createdBy).toBe(ADMIN);
            expect(row.updatedBy).toBe(ADMIN);
            expect(row.archivedAt).not.toBeNull();
        });
    });

    describe('household-private providers follow household roles', () => {
        it('lets an OWNER and a MEMBER create one, and rejects a VIEWER with FORBIDDEN_ROLE', async () => {
            grantRole(ALICE_HOUSEHOLD, MEMBER, 'MEMBER');
            grantRole(ALICE_HOUSEHOLD, VIEWER, 'VIEWER');

            const owner = await createPrivate(ALICE, ALICE_HOUSEHOLD, 'By owner');
            const member = await createPrivate(MEMBER, ALICE_HOUSEHOLD, 'By member');
            const viewer = await createPrivate(VIEWER, ALICE_HOUSEHOLD, 'By viewer');

            expect(owner.status).toBe(201);
            expect(owner.body).toMatchObject({scope: 'HOUSEHOLD', householdId: ALICE_HOUSEHOLD});
            expect(member.status).toBe(201);
            expect(viewer.status).toBe(403);
            expect(viewer.body.code).toBe('FORBIDDEN_ROLE');
        });

        it('treats a non-member as if the household did not exist', async () => {
            const res = await createPrivate(BOB, ALICE_HOUSEHOLD);

            expect(res.status).toBe(404);
            expect(res.body.code).toBe('HOUSEHOLD_NOT_FOUND');
        });

        it('does not let an ADMIN write into a household they do not belong to', async () => {
            const res = await request(server).post('/api/v1/providers')
                .set('Authorization', as(ADMIN, ['USER', 'ADMIN']))
                .send({scope: 'HOUSEHOLD', householdId: ALICE_HOUSEHOLD, name: 'Admin intrusion'});

            expect(res.status).toBe(404);
            expect(res.body.code).toBe('HOUSEHOLD_NOT_FOUND');
        });

        it('lets a MEMBER edit and archive a private provider but not a VIEWER', async () => {
            grantRole(ALICE_HOUSEHOLD, MEMBER, 'MEMBER');
            grantRole(ALICE_HOUSEHOLD, VIEWER, 'VIEWER');
            const priv = (await createPrivate(ALICE, ALICE_HOUSEHOLD)).body;

            const byMember = await request(server).patch(`/api/v1/providers/${priv.id}`)
                .set('Authorization', as(MEMBER)).send({name: 'Edited', archived: true});
            const byViewer = await request(server).patch(`/api/v1/providers/${priv.id}`)
                .set('Authorization', as(VIEWER)).send({name: 'Nope'});

            expect(byMember.status).toBe(200);
            expect(byMember.body).toMatchObject({name: 'Edited', archived: true});
            expect(byViewer.status).toBe(403);
            expect(byViewer.body.code).toBe('FORBIDDEN_ROLE');
        });
    });

    describe('visibility', () => {
        it('shows a household the catalog plus only its own private providers', async () => {
            await createGlobal('Catalog One');
            await createPrivate(ALICE, ALICE_HOUSEHOLD, 'Alice private');
            await createPrivate(BOB, BOB_HOUSEHOLD, 'Bob private');

            const res = await request(server).get(`/api/v1/providers?householdId=${ALICE_HOUSEHOLD}`)
                .set('Authorization', as(ALICE));

            expect(res.status).toBe(200);
            expect(res.body.map((p: { name: string }) => p.name)).toEqual(['Alice private', 'Catalog One']);
        });

        it('returns only the catalog without a household, and narrows by scope', async () => {
            await createGlobal('Catalog One');
            await createPrivate(ALICE, ALICE_HOUSEHOLD, 'Alice private');

            const catalog = await request(server).get('/api/v1/providers').set('Authorization', as(ALICE));
            const onlyPrivate = await request(server)
                .get(`/api/v1/providers?householdId=${ALICE_HOUSEHOLD}&scope=HOUSEHOLD`).set('Authorization', as(ALICE));

            expect(catalog.body.map((p: { name: string }) => p.name)).toEqual(['Catalog One']);
            expect(onlyPrivate.body.map((p: { name: string }) => p.name)).toEqual(['Alice private']);
        });

        it('hides archived providers unless asked', async () => {
            const global = (await createGlobal('Old Co')).body;
            await request(server).patch(`/api/v1/providers/${global.id}`)
                .set('Authorization', as(ADMIN, ['USER', 'ADMIN'])).send({archived: true});

            const hidden = await request(server).get('/api/v1/providers').set('Authorization', as(ALICE));
            const shown = await request(server).get('/api/v1/providers?includeArchived=true').set('Authorization', as(ALICE));

            expect(hidden.body).toEqual([]);
            expect(shown.body).toHaveLength(1);
        });

        it('refuses to list another household\'s providers', async () => {
            const res = await request(server).get(`/api/v1/providers?householdId=${BOB_HOUSEHOLD}`)
                .set('Authorization', as(ALICE));

            expect(res.status).toBe(404);
            expect(res.body.code).toBe('HOUSEHOLD_NOT_FOUND');
        });

        it('reports another household\'s private provider as not found, identically to a missing one', async () => {
            const bobs = (await createPrivate(BOB, BOB_HOUSEHOLD)).body;

            const foreign = await request(server).get(`/api/v1/providers/${bobs.id}`).set('Authorization', as(ALICE));
            const missing = await request(server).get('/api/v1/providers/00000000-0000-4000-8000-000000000000')
                .set('Authorization', as(ALICE));
            const edit = await request(server).patch(`/api/v1/providers/${bobs.id}`)
                .set('Authorization', as(ALICE)).send({name: 'Hijack'});

            expect(foreign.status).toBe(404);
            expect(foreign.body.code).toBe('PROVIDER_NOT_FOUND');
            expect(missing.status).toBe(404);
            expect(edit.status).toBe(404);
            expect(strip(foreign.body)).toEqual(strip(missing.body));
        });

        it('lets any user read a global provider', async () => {
            const global = (await createGlobal()).body;

            const res = await request(server).get(`/api/v1/providers/${global.id}`).set('Authorization', as(BOB));

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(global.id);
        });

        it('does not give an ADMIN a view into a household\'s private providers', async () => {
            const priv = (await createPrivate(ALICE, ALICE_HOUSEHOLD)).body;

            const res = await request(server).get(`/api/v1/providers/${priv.id}`)
                .set('Authorization', as(ADMIN, ['USER', 'ADMIN']));

            expect(res.status).toBe(404);
            expect(res.body.code).toBe('PROVIDER_NOT_FOUND');
        });
    });

    describe('promote', () => {
        it('turns a private provider global without detaching the household\'s accounts', async () => {
            const priv = (await createPrivate(ALICE, ALICE_HOUSEHOLD)).body;
            await prisma.providerAccount.create({
                data: {
                    id: '55555555-5555-4555-8555-555555555555', providerId: priv.id, householdId: ALICE_HOUSEHOLD,
                    label: 'Electricity', rule: RULE, createdBy: ALICE, updatedBy: ALICE,
                },
            });

            const res = await request(server).post(`/api/v1/providers/${priv.id}/promote`)
                .set('Authorization', as(ADMIN, ['USER', 'ADMIN']));

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({id: priv.id, scope: 'GLOBAL'});
            expect(res.body.householdId).toBeNull();
            expect(await prisma.providerAccount.count({where: {providerId: priv.id}})).toBe(1);
            const visibleToBob = await request(server).get(`/api/v1/providers/${priv.id}`).set('Authorization', as(BOB));
            expect(visibleToBob.status).toBe(200);
        });

        it('rejects promoting a provider that is already global', async () => {
            const global = (await createGlobal()).body;

            const res = await request(server).post(`/api/v1/providers/${global.id}/promote`)
                .set('Authorization', as(ADMIN, ['USER', 'ADMIN']));

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('PROVIDER_ALREADY_GLOBAL');
        });

        it('answers 404 for an unknown provider', async () => {
            const res = await request(server).post('/api/v1/providers/00000000-0000-4000-8000-000000000000/promote')
                .set('Authorization', as(ADMIN, ['USER', 'ADMIN']));

            expect(res.status).toBe(404);
        });
    });

    describe('validation', () => {
        it('requires householdId for HOUSEHOLD and forbids it for GLOBAL', async () => {
            const missing = await request(server).post('/api/v1/providers').set('Authorization', as(ALICE))
                .send({scope: 'HOUSEHOLD', name: 'No household'});
            const extra = await request(server).post('/api/v1/providers')
                .set('Authorization', as(ADMIN, ['USER', 'ADMIN']))
                .send({scope: 'GLOBAL', householdId: ALICE_HOUSEHOLD, name: 'Global with household'});

            expect(missing.status).toBe(400);
            expect(extra.status).toBe(400);
            expect(extra.body.errors[0].field).toBe('householdId');
        });

        it('rejects a blank name, an unknown scope and an empty update', async () => {
            const global = (await createGlobal()).body;
            const admin = as(ADMIN, ['USER', 'ADMIN']);

            const blank = await request(server).post('/api/v1/providers').set('Authorization', admin)
                .send({scope: 'GLOBAL', name: '   '});
            const scope = await request(server).post('/api/v1/providers').set('Authorization', admin)
                .send({scope: 'PLANETARY', name: 'X'});
            const empty = await request(server).patch(`/api/v1/providers/${global.id}`).set('Authorization', admin).send({});

            expect(blank.status).toBe(400);
            expect(scope.status).toBe(400);
            expect(empty.status).toBe(400);
        });

        it('rejects an invalid default window with INVALID_SUBMISSION_RULE', async () => {
            const res = await createGlobal('Bad Rule Co', {
                defaultRule: {...RULE, opens: {kind: 'DAY_OF_MONTH', day: 5}, closes: {kind: 'DAY_OF_MONTH', day: 4}},
            });

            expect(res.status).toBe(422);
            expect(res.body.code).toBe('INVALID_SUBMISSION_RULE');
        });
    });

    describe('authentication', () => {
        it('rejects requests without a token', async () => {
            const res = await request(server).get('/api/v1/providers');

            expect(res.status).toBe(401);
            expect(res.body.code).toBe('UNAUTHORIZED');
        });

        it('ignores a roles claim that is not an array of strings', async () => {
            const res = await request(server).post('/api/v1/providers')
                .set('Authorization', `Bearer ${mintToken({subject: ADMIN, roles: 'ADMIN' as unknown as string[]})}`)
                .send({scope: 'GLOBAL', name: 'String roles'});

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN_SYSTEM_ROLE');
        });
    });
});

function strip(problem: Record<string, unknown>): Record<string, unknown> {
    const {correlationId: _correlationId, instance: _instance, ...rest} = problem;
    return rest;
}
