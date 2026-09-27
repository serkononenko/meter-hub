import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {AppModule} from '../src/app.module.js';
import {ALICE_METER, BOB_METER, mintToken, registerMeter} from './global-setup.js';

const ALICE = '11111111-1111-4111-8111-111111111111';

/**
 * Create-reading e2e (6.3 + 6.5): the HTTP surface runs against the real
 * Prisma wiring, the real JWT verification path, and a meter-service stand-in
 * for the ownership check.
 */
describe('Create reading (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('rejects unauthenticated requests with the UNAUTHORIZED problem', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .send({meterId: ALICE_METER, value: 1, recordedAt: '2026-08-27T08:30:00Z'});

        expect(response.status).toBe(401);
        expect(response.headers['content-type']).toContain('application/problem+json');
        expect(response.body).toMatchObject({
            code: 'UNAUTHORIZED',
            title: 'Authentication required',
            status: 401,
        });
        expect(response.headers['www-authenticate']).toBe('Bearer');
    });

    it('rejects invalid tokens with the INVALID_TOKEN problem', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', 'Bearer not-a-jwt')
            .send({meterId: ALICE_METER, value: 1, recordedAt: '2026-08-27T08:30:00Z'});

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({code: 'INVALID_TOKEN', status: 401});
    });

    it('creates a reading for a meter owned by the token subject', async () => {
        const token = await mintToken({subject: ALICE});

        const created = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .set('X-Correlation-ID', '7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10')
            .send({
                meterId: ALICE_METER,
                value: 15432.1,
                recordedAt: '2026-08-27T08:30:00Z',
            });

        expect(created.status).toBe(201);
        expect(created.headers['content-type']).toContain('application/json');
        expect(created.body).toMatchObject({
            meterId: ALICE_METER,
            value: 15432.1,
            recordedAt: '2026-08-27T08:30:00.000Z',
            source: 'MANUAL',
        });
        expect(created.body.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(created.body.createdAt).toMatch(/Z$/);
        expect(created.headers['x-correlation-id']).toBe('7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10');
    });

    it('rejects a reading for someone else\'s meter with the same 404 as an unknown one', async () => {
        const token = await mintToken({subject: ALICE});

        const foreign = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId: BOB_METER, value: 1, recordedAt: '2026-08-27T08:30:00Z'});
        const unknown = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId: crypto.randomUUID(), value: 1, recordedAt: '2026-08-27T08:30:00Z'});

        expect(foreign.status).toBe(404);
        expect(unknown.status).toBe(404);
        expect(foreign.body.code).toBe('METER_NOT_FOUND');
        const {correlationId: _c, instance: _i, detail: _d, ...rest} = foreign.body;
        const {correlationId: _c2, instance: _i2, detail: _d2, ...restUnknown} = unknown.body;
        expect(restUnknown).toEqual(rest);
    });

    it('returns a validation problem for a bad create body', async () => {
        const token = await mintToken({subject: ALICE});

        const response = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId: 'not-a-uuid', value: -5, recordedAt: 'yesterday'});

        expect(response.status).toBe(400);
        expect(response.headers['content-type']).toContain('application/problem+json');
        expect(response.body).toMatchObject({
            code: 'VALIDATION_ERROR',
            status: 400,
            title: 'Validation failed',
        });
        const fields = response.body.errors.map((e: { field: string }) => e.field).sort();
        expect(fields).toEqual(['meterId', 'recordedAt', 'value']);
    });

    it('normalizes an offset timestamp to UTC Z form', async () => {
        const token = await mintToken({subject: ALICE});

        const response = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({
                meterId: freshMeter(),
                value: 1,
                recordedAt: '2026-08-27T10:30:00+02:00',
            });

        expect(response.status).toBe(201);
        expect(response.body.recordedAt).toBe('2026-08-27T08:30:00.000Z');
    });

    it('accepts first, equal, and increasing readings for a cumulative meter', async () => {
        const token = await mintToken({subject: ALICE});
        const meterId = freshMeter();

        const first = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 100, recordedAt: '2026-08-01T08:00:00Z'});
        const equal = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 100, recordedAt: '2026-08-02T08:00:00Z'});
        const increasing = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 250.5, recordedAt: '2026-08-03T08:00:00Z'});

        expect(first.status).toBe(201);
        expect(equal.status).toBe(201);
        expect(increasing.status).toBe(201);
    });

    it('rejects a decreasing reading with the READING_DECREASING problem', async () => {
        const token = await mintToken({subject: ALICE});
        const meterId = freshMeter();

        await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 500, recordedAt: '2026-08-01T08:00:00Z'});

        const decreasing = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 499, recordedAt: '2026-08-02T08:00:00Z'});

        expect(decreasing.status).toBe(422);
        expect(decreasing.headers['content-type']).toContain('application/problem+json');
        expect(decreasing.body).toMatchObject({
            code: 'READING_DECREASING',
            title: 'Reading is lower than the previous one',
            status: 422,
        });
        expect(decreasing.body.errors).toEqual([
            {field: 'value', message: 'must not be lower than the previous reading'},
        ]);

        // The rejected reading was not persisted.
        const history = await request(app.getHttpServer())
            .get(`/api/v1/meters/${meterId}/readings`)
            .set('Authorization', `Bearer ${token}`);
        expect(history.body.items.map((r: { value: number }) => r.value)).toEqual([500]);
    });

    it('compares against the previous reading in recordedAt order, not creation order', async () => {
        const token = await mintToken({subject: ALICE});
        const meterId = freshMeter();

        // Create a late reading first, then an earlier one below it — the
        // earlier one is only compared to readings before it (none), so it
        // passes even though the meter already holds a higher value.
        await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 300, recordedAt: '2026-08-10T08:00:00Z'});

        const backdated = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 100, recordedAt: '2026-08-01T08:00:00Z'});

        expect(backdated.status).toBe(201);

        // But an even earlier reading below the backdated one is rejected.
        const below = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 50, recordedAt: '2026-08-05T08:00:00Z'});

        expect(below.status).toBe(422);
        expect(below.body.code).toBe('READING_DECREASING');
    });

    it('rejects a future recordedAt with RECORDED_AT_IN_FUTURE (backlog D2)', async () => {
        const token = await mintToken({subject: ALICE});
        const meterId = freshMeter();

        const response = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 100, recordedAt: '2999-01-01T00:00:00Z'});

        expect(response.status).toBe(422);
        expect(response.headers['content-type']).toContain('application/problem+json');
        expect(response.body).toMatchObject({
            code: 'RECORDED_AT_IN_FUTURE',
            status: 422,
            title: 'Reading timestamp is in the future',
        });
        expect(response.body.errors).toEqual([
            {field: 'recordedAt', message: 'must not be in the future'},
        ]);

        // rejected reading was not persisted.
        const history = await request(app.getHttpServer())
            .get(`/api/v1/meters/${meterId}/readings`)
            .set('Authorization', `Bearer ${token}`);
        expect(history.body.total).toBe(0);
    });

    it('rejects a recordedAt older than the 5-year window with RECORDED_AT_TOO_OLD (backlog D2)', async () => {
        const token = await mintToken({subject: ALICE});
        const meterId = freshMeter();

        const response = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send({meterId, value: 100, recordedAt: '1994-05-01T00:00:00Z'});

        expect(response.status).toBe(422);
        expect(response.headers['content-type']).toContain('application/problem+json');
        expect(response.body).toMatchObject({
            code: 'RECORDED_AT_TOO_OLD',
            status: 422,
            title: 'Reading timestamp is too far in the past',
        });
        expect(response.body.errors).toEqual([
            {field: 'recordedAt', message: 'must not be older than 5 years'},
        ]);
    });

    it('returns a paged envelope with server-applied limit and offset', async () => {
        const token = await mintToken({subject: ALICE});
        const meterId = freshMeter();

        for (let day = 1; day <= 3; day++) {
            const created = await request(app.getHttpServer())
                .post('/api/v1/readings')
                .set('Authorization', `Bearer ${token}`)
                .send({meterId, value: day, recordedAt: `2026-08-0${day}T08:00:00Z`});
            expect(created.status).toBe(201);
        }

        // Default page (limit 50, offset 0).
        const first = await request(app.getHttpServer())
            .get(`/api/v1/meters/${meterId}/readings`)
            .set('Authorization', `Bearer ${token}`);
        expect(first.status).toBe(200);
        expect(first.body.items).toHaveLength(3);
        expect(first.body.total).toBe(3);
        expect(first.body.limit).toBe(50);
        expect(first.body.offset).toBe(0);
        expect(first.body.items.map((r: { value: number }) => r.value)).toEqual([3, 2, 1]);

        // Second page: only the remaining item, total unchanged.
        const second = await request(app.getHttpServer())
            .get(`/api/v1/meters/${meterId}/readings?limit=2&offset=2`)
            .set('Authorization', `Bearer ${token}`);
        expect(second.status).toBe(200);
        expect(second.body.items.map((r: { value: number }) => r.value)).toEqual([1]);
        expect(second.body.total).toBe(3);
        expect(second.body.limit).toBe(2);
        expect(second.body.offset).toBe(2);

        // Out-of-range limit is clamped, echoed value reflects the cap.
        const capped = await request(app.getHttpServer())
            .get(`/api/v1/meters/${meterId}/readings?limit=5000`)
            .set('Authorization', `Bearer ${token}`);
        expect(capped.status).toBe(200);
        expect(capped.body.limit).toBe(200);

        // Offset past the end: empty items, total still accurate.
        const pastEnd = await request(app.getHttpServer())
            .get(`/api/v1/meters/${meterId}/readings?offset=10`)
            .set('Authorization', `Bearer ${token}`);
        expect(pastEnd.status).toBe(200);
        expect(pastEnd.body.items).toEqual([]);
        expect(pastEnd.body.total).toBe(3);
    });

    it('replays the original response for a repeated Idempotency-Key (backlog C3)', async () => {
        const token = await mintToken({subject: ALICE});
        const meterId = freshMeter();
        const key = crypto.randomUUID();
        const payload = {meterId, value: 777, recordedAt: '2026-08-15T08:00:00Z'};

        const first = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', key)
            .send(payload);
        expect(first.status).toBe(201);

        const retry = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', key)
            .send(payload);

        expect(retry.status).toBe(201);
        expect(retry.body).toEqual(first.body);

        // Exactly one reading was created.
        const history = await request(app.getHttpServer())
            .get(`/api/v1/meters/${meterId}/readings`)
            .set('Authorization', `Bearer ${token}`);
        expect(history.body.total).toBe(1);
    });

    it('rejects an Idempotency-Key reused with a different body (backlog C3)', async () => {
        const token = await mintToken({subject: ALICE});
        const meterId = freshMeter();
        const key = crypto.randomUUID();

        const first = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', key)
            .send({meterId, value: 100, recordedAt: '2026-08-15T08:00:00Z'});
        expect(first.status).toBe(201);

        const reuse = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', key)
            .send({meterId, value: 200, recordedAt: '2026-08-15T08:00:00Z'});

        expect(reuse.status).toBe(409);
        expect(reuse.headers['content-type']).toContain('application/problem+json');
        expect(reuse.body).toMatchObject({
            code: 'IDEMPOTENCY_KEY_REUSE',
            status: 409,
            title: 'Idempotency key already used',
        });
    });

    it('rejects another user presenting a key they did not create (backlog C3)', async () => {
        const alice = await mintToken({subject: ALICE});
        const bob = await mintToken({subject: '22222222-2222-4222-8222-222222222222'});
        const aliceMeter = freshMeter();
        const key = crypto.randomUUID();

        const first = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${alice}`)
            .set('Idempotency-Key', key)
            .send({meterId: aliceMeter, value: 100, recordedAt: '2026-08-15T08:00:00Z'});
        expect(first.status).toBe(201);

        // Bob replays Alice's key against his own meter — keys are scoped
        // per user, so this is a reuse conflict, not a cross-user leak.
        const stolen = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${bob}`)
            .set('Idempotency-Key', key)
            .send({meterId: BOB_METER, value: 100, recordedAt: '2026-08-15T08:00:00Z'});

        expect(stolen.status).toBe(409);
        expect(stolen.body.code).toBe('IDEMPOTENCY_KEY_REUSE');
    });

    it('treats requests without an Idempotency-Key as before', async () => {
        const token = await mintToken({subject: ALICE});
        const meterId = freshMeter();
        const payload = {meterId, value: 50, recordedAt: '2026-08-15T08:00:00Z'};

        const first = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send(payload);
        const second = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('Authorization', `Bearer ${token}`)
            .send(payload);

        expect(first.status).toBe(201);
        expect(second.status).toBe(201);
        // No key: both submissions create readings (duplicate allowed, as documented).
        expect(first.body.id).not.toBe(second.body.id);
    });
});

/** A meter owned by ALICE that no other test run has seen. */
function freshMeter(): string {
    return registerMeter(crypto.randomUUID(), ALICE);
}
