import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {AppModule} from '../src/app.module.js';
import {VerdictCache} from '../src/household/verdict-cache.js';
import {
    ALICE_HOUSEHOLD,
    ALICE_METER,
    bringHouseholdBack,
    bringMeterBack,
    grantRole,
    mintToken,
    registerMeter,
    revokeMembership,
    takeHouseholdDown,
    takeMeterDown,
} from './global-setup.js';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

/**
 * Role-aware authorization e2e (A3 Epic R4): exercises the membership-role
 * checks through the HTTP surface, with meter-service stood in by the shared
 * visibility stub and household-service by the internal verdict stub.
 */
describe('Reading roles (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('lets a VIEWER read readings but rejects submitting with FORBIDDEN_ROLE', async () => {
        const viewer = '33333333-3333-4333-8333-333333333333';
        grantRole(ALICE_HOUSEHOLD, viewer, 'VIEWER');
        const alice = await mintToken({subject: ALICE});
        await seedReading(alice, ALICE_METER);
        try {
            const viewerToken = await mintToken({subject: viewer});

            const list = await request(app.getHttpServer())
                .get(`/api/v1/meters/${ALICE_METER}/readings`)
                .set('Authorization', `Bearer ${viewerToken}`);
            expect(list.status).toBe(200);
            expect(list.body.items.length).toBeGreaterThanOrEqual(1);

            const latest = await request(app.getHttpServer())
                .get(`/api/v1/meters/${ALICE_METER}/readings/latest`)
                .set('Authorization', `Bearer ${viewerToken}`);
            expect(latest.status).toBe(200);

            const submit = await request(app.getHttpServer())
                .post('/api/v1/readings')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send({meterId: ALICE_METER, value: 10, recordedAt: '2026-08-20T08:00:00Z'});
            expect(submit.status).toBe(403);
            expect(submit.body.code).toBe('FORBIDDEN_ROLE');
        } finally {
            revokeMembership(ALICE_HOUSEHOLD, viewer);
        }
    });

    it('lets a MEMBER submit readings', async () => {
        const member = '44444444-4444-4444-8444-444444444444';
        grantRole(ALICE_HOUSEHOLD, member, 'MEMBER');
        try {
            const memberToken = await mintToken({subject: member});

            const created = await request(app.getHttpServer())
                .post('/api/v1/readings')
                .set('Authorization', `Bearer ${memberToken}`)
                .send({meterId: ALICE_METER, value: 10, recordedAt: '2026-08-21T08:00:00Z'});

            expect(created.status).toBe(201);
        } finally {
            revokeMembership(ALICE_HOUSEHOLD, member);
        }
    });

    it('re-rejects a removed member once the verdict cache expires', async () => {
        const member = '55555555-5555-4555-8555-555555555555';
        grantRole(ALICE_HOUSEHOLD, member, 'MEMBER');
        const memberToken = await mintToken({subject: member});

        const created = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${memberToken}`)
            .send({meterId: ALICE_METER, value: 10, recordedAt: '2026-08-22T08:00:00Z'});
        expect(created.status).toBe(201);

        // Owner removes the member; next cold verdict (after cache reset)
        // must deny them with the enumeration-safe 404.
        revokeMembership(ALICE_HOUSEHOLD, member);
        app.get(VerdictCache).clear();

        const afterRemoval = await request(app.getHttpServer())
            .get(`/api/v1/meters/${ALICE_METER}/readings`)
            .set('Authorization', `Bearer ${memberToken}`);
        expect(afterRemoval.status).toBe(404);
        expect(afterRemoval.body.code).toBe('METER_NOT_FOUND');
    });

    it('keeps non-member isolation: foreign and unknown meters share the same 404', async () => {
        const bob = await mintToken({subject: BOB});

        const foreign = await request(app.getHttpServer())
            .get(`/api/v1/meters/${ALICE_METER}/readings`)
            .set('Authorization', `Bearer ${bob}`);
        const unknown = await request(app.getHttpServer())
            .get(`/api/v1/meters/${crypto.randomUUID()}/readings`)
            .set('Authorization', `Bearer ${bob}`);

        expect(foreign.status).toBe(404);
        expect(unknown.status).toBe(404);
        expect(foreign.body.code).toBe('METER_NOT_FOUND');
        expect(stableProblem(unknown.body)).toEqual(stableProblem(foreign.body));

        const foreignSubmit = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${bob}`)
            .send({meterId: ALICE_METER, value: 1, recordedAt: '2026-08-23T08:00:00Z'});
        expect(foreignSubmit.status).toBe(404);
        expect(foreignSubmit.body.code).toBe('METER_NOT_FOUND');
        expect(foreignSubmit.headers['content-type']).toContain('application/problem+json');
    });

    it('answers 503 when household-service is unreachable (fail closed)', async () => {
        const alice = await mintToken({subject: ALICE});
        await takeHouseholdDown();
        try {
            // The verdict cache may still hold entries from earlier tests in
            // this run; a cold verdict is what proves the fail-closed path.
            // Only submissions reach the verdict — reads are covered by the
            // meter-service visibility mask alone.
            app.get(VerdictCache).clear();

            const response = await request(app.getHttpServer())
                .post('/api/v1/readings')
                .set('Authorization', `Bearer ${alice}`)
                .send({meterId: ALICE_METER, value: 1, recordedAt: '2026-08-24T08:00:00Z'});

            expect(response.status).toBe(503);
            expect(response.body.code).toBe('HOUSEHOLD_SERVICE_UNAVAILABLE');
        } finally {
            await bringHouseholdBack();
        }
    });

    it('answers 503 when meter-service is unreachable (fail closed)', async () => {
        const alice = await mintToken({subject: ALICE});
        await takeMeterDown();
        try {
            app.get(VerdictCache).clear();

            const response = await request(app.getHttpServer())
                .get(`/api/v1/meters/${ALICE_METER}/readings`)
                .set('Authorization', `Bearer ${alice}`);

            expect(response.status).toBe(503);
            expect(response.body.code).toBe('METER_SERVICE_UNAVAILABLE');
        } finally {
            await bringMeterBack();
        }
    });

    it('still answers READING_NOT_FOUND for an accessible meter without readings', async () => {
        const alice = await mintToken({subject: ALICE});
        const emptyMeter = registerMeter(crypto.randomUUID(), ALICE);

        const response = await request(app.getHttpServer())
            .get(`/api/v1/meters/${emptyMeter}/readings/latest`)
            .set('Authorization', `Bearer ${alice}`);

        expect(response.status).toBe(404);
        expect(response.body.code).toBe('READING_NOT_FOUND');
    });

    async function seedReading(token: string, meterId: string) {
        const response = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 10, recordedAt: '2026-08-19T08:00:00Z'});
        expect(response.status).toBe(201);
        return response.body as { id: string };
    }
});

/** Problem body without request-scoped fields, for enumeration-safety diffs. */
function stableProblem(body: Record<string, unknown>) {
    const {correlationId: _c, instance: _i, detail: _d, ...rest} = body;
    return rest;
}
