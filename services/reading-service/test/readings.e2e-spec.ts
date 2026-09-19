import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {AppModule} from '../src/app.module.js';

const METER_ID = '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01';

/**
 * Create-reading e2e (6.3): the HTTP surface runs against the real Prisma
 * wiring and the local reading_db. Authorization (the caller's access to the
 * meter) arrives with 6.5; until then meterId is accepted as a plain
 * reference.
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

    it('creates a reading and reads it back', async () => {
        const created = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .set('X-Correlation-ID', '7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10')
            .send({
                meterId: METER_ID,
                value: 15432.1,
                recordedAt: '2026-08-27T08:30:00Z',
            });

        expect(created.status).toBe(201);
        expect(created.headers['content-type']).toContain('application/json');
        expect(created.body).toMatchObject({
            meterId: METER_ID,
            value: 15432.1,
            recordedAt: '2026-08-27T08:30:00.000Z',
            source: 'MANUAL',
        });
        expect(created.body.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(created.body.createdAt).toMatch(/Z$/);
        expect(created.headers['x-correlation-id']).toBe('7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10');

        const listed = await request(app.getHttpServer())
            .get('/health');
        expect(listed.status).toBe(200);
    });

    it('returns a validation problem for a bad create body', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/readings')
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

    it('returns a validation problem when the timestamp is missing', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .send({meterId: METER_ID, value: 10});

        expect(response.status).toBe(400);
        expect(response.body.errors.map((e: { field: string }) => e.field)).toEqual(['recordedAt']);
    });

    it('normalizes an offset timestamp to UTC Z form', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/readings')
            .send({
                meterId: METER_ID,
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
