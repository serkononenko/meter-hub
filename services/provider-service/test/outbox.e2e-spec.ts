import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest';
import {AppModule} from '../src/app.module.js';
import {PrismaService} from '../src/database/prisma.service.js';
import {OutboxRelay} from '../src/outbox/outbox.relay.js';
import {KafkaProducerService} from '../src/events/kafka-producer.service.js';
import {VerdictCache} from '../src/household/verdict-cache.js';
import {
    ADMIN,
    ALICE,
    ALICE_HOUSEHOLD,
    BOB_HOUSEHOLD,
    forgetMeters,
    grantRole,
    mintToken,
    registerMeter,
    revokeMembership,
} from './global-setup.js';

const METER = '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01';
const VIEWER = '33333333-3333-4333-8333-333333333333';

const RULE = {
    cycle: 'MONTHLY',
    opens: {kind: 'DAY_OF_MONTH', day: 20},
    closes: {kind: 'LAST_DAY', offsetDays: 0},
    timezone: 'Europe/Kyiv',
};

describe('Outbox (e2e)', () => {
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

    const events = () => prisma.providerOutbox.findMany({orderBy: {createdAt: 'asc'}});

    async function account(label = 'Electricity') {
        const provider = (await request(server).post('/api/v1/providers').set('Authorization', as(ADMIN, ['USER', 'ADMIN']))
            .send({scope: 'GLOBAL', name: `Energy ${label}`})).body;
        const res = await request(server).post('/api/v1/provider-accounts').set('Authorization', as(ALICE))
            .send({providerId: provider.id, householdId: ALICE_HOUSEHOLD, label, rule: RULE});
        return res.body as { id: string; version: number };
    }

    const patchAccount = (id: string, body: object) => request(server)
        .patch(`/api/v1/provider-accounts/${id}`).set('Authorization', as(ALICE)).send(body);

    describe('accounts', () => {
        it('writes one account.changed snapshot when an account is created, in the same change', async () => {
            const created = await account();

            const [event] = await events();
            expect(await prisma.providerOutbox.count({where: {aggregateId: created.id}})).toBe(1);
            expect(event).toMatchObject({eventType: 'provider.account.changed', aggregateId: created.id, publishedAt: null});
            expect(event.payload).toMatchObject({
                eventId: event.id,
                eventType: 'provider.account.changed',
                eventVersion: 1,
                producer: 'provider-service',
                data: {accountId: created.id, householdId: ALICE_HOUSEHOLD, version: 1, rule: RULE, archived: false},
            });
        });

        it('writes a new snapshot with the bumped version for each real change, and none for a no-op', async () => {
            const created = await account();

            await patchAccount(created.id, {label: 'Main electricity'});
            await patchAccount(created.id, {label: 'Main electricity'});
            await patchAccount(created.id, {rule: {...RULE, opens: {kind: 'DAY_OF_MONTH', day: 15}}});
            await patchAccount(created.id, {archived: true});

            const versions = (await events()).map((e) => (e.payload as { data: { version: number } }).data.version);
            expect(versions).toEqual([1, 2, 3, 4]);
            const last = (await events()).at(-1)!.payload as { data: { archived: boolean } };
            expect(last.data.archived).toBe(true);
        });

        it('writes nothing for requests that are rejected', async () => {
            const created = await account();
            await prisma.providerOutbox.deleteMany();
            grantRole(ALICE_HOUSEHOLD, VIEWER, 'VIEWER');

            const viewer = await request(server).patch(`/api/v1/provider-accounts/${created.id}`)
                .set('Authorization', as(VIEWER)).send({label: 'Nope'});
            const invalid = await patchAccount(created.id, {rule: {...RULE, timezone: 'Mars/Phobos'}});
            const empty = await patchAccount(created.id, {});

            expect([viewer.status, invalid.status, empty.status]).toEqual([403, 422, 400]);
            expect(await prisma.providerOutbox.count()).toBe(0);
        });

        it('carries the account\'s id and version but none of its user-facing fields', async () => {
            const provider = (await request(server).post('/api/v1/providers').set('Authorization', as(ADMIN, ['USER', 'ADMIN']))
                .send({scope: 'GLOBAL', name: 'Energy Co'})).body;
            await request(server).post('/api/v1/provider-accounts').set('Authorization', as(ALICE))
                .send({providerId: provider.id, householdId: ALICE_HOUSEHOLD, label: 'Private label', accountNumber: '0012345678', rule: RULE});

            const raw = JSON.stringify((await events())[0].payload);

            expect(raw).not.toContain('Private label');
            expect(raw).not.toContain('0012345678');
        });
    });

    describe('bindings', () => {
        it('writes a binding.changed snapshot keyed by the meter on bind, and a version 2 snapshot when ended', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const acc = await account();
            await prisma.providerOutbox.deleteMany();

            const binding = (await request(server).post('/api/v1/meter-bindings').set('Authorization', as(ALICE))
                .send({accountId: acc.id, meterId: METER, validFrom: '2026-01-01'})).body;
            await request(server).patch(`/api/v1/meter-bindings/${binding.id}`).set('Authorization', as(ALICE)).send({validTo: '2026-06-30'});

            const [bound, ended] = await events();
            expect(bound).toMatchObject({eventType: 'provider.binding.changed', aggregateId: METER});
            expect(bound.payload).toMatchObject({data: {bindingId: binding.id, meterId: METER, validFrom: '2026-01-01', validTo: null, version: 1}});
            expect(ended.payload).toMatchObject({data: {bindingId: binding.id, validTo: '2026-06-30', version: 2}});
        });

        it('writes nothing when binding is rejected, so a lost race leaves no event behind', async () => {
            registerMeter(METER, ALICE_HOUSEHOLD);
            const accounts = await Promise.all([account('One'), account('Two'), account('Three'), account('Four')]);
            await prisma.providerOutbox.deleteMany();

            const results = await Promise.all(Array.from({length: 16}, (_, i) =>
                request(server).post('/api/v1/meter-bindings').set('Authorization', as(ALICE))
                    .send({accountId: accounts[i % accounts.length].id, meterId: METER})));

            expect(results.filter((r) => r.status === 201)).toHaveLength(1);
            expect(await prisma.providerOutbox.count()).toBe(1);
        });

        it('writes nothing for a bind that is refused for a household mismatch', async () => {
            grantRole(BOB_HOUSEHOLD, ALICE, 'MEMBER');
            registerMeter('2f9bac48-8b8b-4c77-9c93-5df33e2c3b23', BOB_HOUSEHOLD);
            const acc = await account();
            await prisma.providerOutbox.deleteMany();

            const res = await request(server).post('/api/v1/meter-bindings').set('Authorization', as(ALICE))
                .send({accountId: acc.id, meterId: '2f9bac48-8b8b-4c77-9c93-5df33e2c3b23'});
            revokeMembership(BOB_HOUSEHOLD, ALICE);

            expect(res.status).toBe(422);
            expect(await prisma.providerOutbox.count()).toBe(0);
        });
    });

    describe('atomicity', () => {
        it('rolls the change back when the outbox write fails, so a state change never exists without its event', async () => {
            const acc = await account();
            await prisma.providerOutbox.deleteMany();
            const original = prisma.providerOutbox.create.bind(prisma.providerOutbox);
            let calls = 0;
            // Interception point is the transaction client the service uses, so patch the delegate on the base client.
            const outboxModule = await import('../src/outbox/outbox.repository.js');
            const repo = app.get(outboxModule.OutboxRepository);
            const realSave = repo.save.bind(repo);
            repo.save = async () => {
                calls++;
                throw new Error('outbox write failed');
            };
            try {
                const res = await patchAccount(acc.id, {label: 'Should not stick'});

                expect(res.status).toBe(500);
                expect(calls).toBe(1);
                const row = await prisma.providerAccount.findUniqueOrThrow({where: {id: acc.id}});
                expect(row.label).toBe('Electricity');
                expect(row.version).toBe(1);
            } finally {
                repo.save = realSave;
                void original;
            }
        });
    });

    describe('relay', () => {
        it('publishes the pending events to Kafka in order and marks them published', async () => {
            const sent: Array<{ topic: string; key: string }> = [];
            const producer = app.get(KafkaProducerService);
            const realSend = producer.send.bind(producer);
            producer.send = async (topic: string, key: string) => {
                sent.push({topic, key});
            };
            try {
                registerMeter(METER, ALICE_HOUSEHOLD);
                const acc = await account();
                const bound = await request(server).post('/api/v1/meter-bindings').set('Authorization', as(ALICE))
                    .send({accountId: acc.id, meterId: METER});
                expect(bound.status, JSON.stringify(bound.body)).toBe(201);
                expect((await events()).every((e) => e.publishedAt === null)).toBe(true);

                await app.get(OutboxRelay).relayRound();

                expect(sent).toEqual([
                    {topic: 'provider.account.changed', key: acc.id},
                    {topic: 'provider.binding.changed', key: METER},
                ]);
                expect((await events()).every((e) => e.publishedAt !== null)).toBe(true);
            } finally {
                producer.send = realSend;
            }
        });

        it('leaves events queued, and still serves requests, when publishing fails', async () => {
            const producer = app.get(KafkaProducerService);
            const realSend = producer.send.bind(producer);
            producer.send = async () => {
                throw new Error('broker down');
            };
            try {
                const acc = await account();

                await app.get(OutboxRelay).relayRound();

                const queued = await prisma.providerOutbox.findMany({where: {aggregateId: acc.id}});
                expect(queued).toHaveLength(1);
                expect(queued[0].publishedAt).toBeNull();
                const read = await request(server).get(`/api/v1/provider-accounts/${acc.id}`).set('Authorization', as(ALICE));
                expect(read.status).toBe(200);
            } finally {
                producer.send = realSend;
            }
        });
    });
});
