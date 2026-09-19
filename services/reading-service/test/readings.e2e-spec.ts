import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {AppModule} from '../src/app.module.js';
import {ALICE_METER, BOB_METER, mintToken} from './global-setup.js';

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
                meterId: ALICE_METER,
                value: 1,
                recordedAt: '2026-08-27T10:30:00+02:00',
            });

        expect(response.status).toBe(201);
        expect(response.body.recordedAt).toBe('2026-08-27T08:30:00.000Z');
    });

    afterAll(async () => {
        await app.close();
    });
});
