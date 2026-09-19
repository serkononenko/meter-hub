import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {AppModule} from '../src/app.module.js';
import {ALICE_METER, BOB_METER, bringMeterBack, mintToken, takeMeterDown} from './global-setup.js';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

/**
 * Cross-user authorization e2e (6.5): exercises the ownership checks through
 * the HTTP surface, with meter-service stood in by the shared owner-scoped
 * stub (200 for the subject's own meter, 404 otherwise).
 */
describe('Reading authorization (e2e)', () => {
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

    it('hides someone else\'s reading history behind the same 404 as an unknown meter', async () => {
        const alice = await mintToken({subject: ALICE});
        const bob = await mintToken({subject: BOB});
        await seedReading(alice, ALICE_METER);

        const foreign = await request(app.getHttpServer())
            .get(`/api/v1/meters/${ALICE_METER}/readings`)
            .set('Authorization', `Bearer ${bob}`);
        const unknown = await request(app.getHttpServer())
            .get(`/api/v1/meters/${crypto.randomUUID()}/readings`)
            .set('Authorization', `Bearer ${bob}`);

        expect(foreign.status).toBe(404);
        expect(foreign.body.code).toBe('METER_NOT_FOUND');
        // Foreign and unknown meters are indistinguishable apart from
        // request-scoped fields.
        expect(stableProblem(unknown.body)).toEqual(stableProblem(foreign.body));

        // The owner still sees the history (its length grows across the
        // suite — the shared e2e database is not reset between files).
        const owner = await request(app.getHttpServer())
            .get(`/api/v1/meters/${ALICE_METER}/readings`)
            .set('Authorization', `Bearer ${alice}`);
        expect(owner.status).toBe(200);
        expect(owner.body.length).toBeGreaterThanOrEqual(1);
        expect(owner.body[0].meterId).toBe(ALICE_METER);
    });

    it('hides someone else\'s latest reading behind the same 404', async () => {
        const alice = await mintToken({subject: ALICE});
        const bob = await mintToken({subject: BOB});
        await seedReading(alice, ALICE_METER);

        const foreign = await request(app.getHttpServer())
            .get(`/api/v1/meters/${ALICE_METER}/readings/latest`)
            .set('Authorization', `Bearer ${bob}`);
        const unknown = await request(app.getHttpServer())
            .get(`/api/v1/meters/${crypto.randomUUID()}/readings/latest`)
            .set('Authorization', `Bearer ${bob}`);

        expect(foreign.status).toBe(404);
        expect(foreign.body.code).toBe('METER_NOT_FOUND');
        expect(stableProblem(unknown.body)).toEqual(stableProblem(foreign.body));
    });

    it('answers READING_NOT_FOUND for an accessible meter without readings', async () => {
        const bob = await mintToken({subject: BOB});

        const response = await request(app.getHttpServer())
            .get(`/api/v1/meters/${BOB_METER}/readings/latest`)
            .set('Authorization', `Bearer ${bob}`);

        expect(response.status).toBe(404);
        expect(response.body.code).toBe('READING_NOT_FOUND');
    });

    it('answers 503 when meter-service is unreachable (fail closed)', async () => {
        const alice = await mintToken({subject: ALICE});
        await takeMeterDown();
        try {
            const response = await request(app.getHttpServer())
                .get(`/api/v1/meters/${ALICE_METER}/readings`)
                .set('Authorization', `Bearer ${alice}`);

            expect(response.status).toBe(503);
            expect(response.body.code).toBe('METER_SERVICE_UNAVAILABLE');
        } finally {
            await bringMeterBack();
        }
    });

    async function seedReading(token: string, meterId: string) {
        const response = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 10, recordedAt: '2026-08-01T08:00:00Z'});
        expect(response.status).toBe(201);
        return response.body as { id: string };
    }
});

/** Problem body without request-scoped fields, for enumeration-safety diffs. */
function stableProblem(body: Record<string, unknown>) {
    const {correlationId: _c, instance: _i, detail: _d, ...rest} = body;
    return rest;
}
