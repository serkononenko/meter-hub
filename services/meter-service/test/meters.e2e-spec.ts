import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {AppModule} from '../src/app.module.js';
import {ALICE_HOUSEHOLD, mintToken} from './global-setup.js';

const ALICE = '11111111-1111-4111-8111-111111111111';

/**
 * Meter API end-to-end (5.3): the HTTP surface runs against the real Prisma
 * wiring and the real JWT verification path (keys come from the shared e2e
 * setup). The database is the local meter_db.
 */
describe('Meters (e2e)', () => {
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
            .post('/api/v1/meters')
            .send({householdId: ALICE_HOUSEHOLD, type: 'ELECTRICITY', name: 'X', serialNumber: 'S', unit: 'KWH'});

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
            .get('/api/v1/meters')
            .query({householdId: ALICE_HOUSEHOLD})
            .set('Authorization', 'Bearer not-a-jwt');

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({code: 'INVALID_TOKEN', status: 401});
    });

    it('creates and reads back a meter for the token subject', async () => {
        const token = await mintToken({subject: ALICE});

        const created = await request(app.getHttpServer())
            .post('/api/v1/meters')
            .set('Authorization', `Bearer ${token}`)
            .send({
                householdId: ALICE_HOUSEHOLD,
                type: 'ELECTRICITY',
                name: 'Main electricity meter',
                serialNumber: 'EL-123456',
                unit: 'KWH',
            });

        expect(created.status).toBe(201);
        expect(created.body).toMatchObject({
            householdId: ALICE_HOUSEHOLD,
            type: 'ELECTRICITY',
            name: 'Main electricity meter',
            serialNumber: 'EL-123456',
            unit: 'KWH',
            status: 'ACTIVE',
        });
        expect(created.body.id).toBeDefined();
        expect(created.body.createdAt).toMatch(/Z$/);

        const fetched = await request(app.getHttpServer())
            .get(`/api/v1/meters/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(fetched.status).toBe(200);
        expect(fetched.body.id).toBe(created.body.id);
    });

    it('returns a validation problem for a bad create body', async () => {
        const token = await mintToken({subject: ALICE});

        const response = await request(app.getHttpServer())
            .post('/api/v1/meters')
            .set('Authorization', `Bearer ${token}`)
            .send({householdId: 'not-a-uuid', type: 'SOLAR', name: '', unit: 'BARRELS'});

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            code: 'VALIDATION_ERROR',
            status: 400,
            title: 'Validation failed',
        });
        const fields = response.body.errors.map((e: { field: string }) => e.field).sort();
        expect(fields).toEqual(['householdId', 'name', 'serialNumber', 'type', 'unit']);
    });

    it('updates a meter and archives it', async () => {
        const token = await mintToken({subject: ALICE});
        const created = await createMeter(token);

        const updated = await request(app.getHttpServer())
            .patch(`/api/v1/meters/${created.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({name: 'Renovated meter', status: 'ARCHIVED'});

        expect(updated.status).toBe(200);
        expect(updated.body).toMatchObject({name: 'Renovated meter', status: 'ARCHIVED'});
        expect(updated.body.updatedAt >= updated.body.createdAt).toBe(true);
    });

    afterAll(async () => {
        await app.close();
    });

    async function createMeter(token: string) {
        const response = await request(app.getHttpServer())
            .post('/api/v1/meters')
            .set('Authorization', `Bearer ${token}`)
            .send({
                householdId: ALICE_HOUSEHOLD,
                type: 'GAS',
                name: 'Gas meter',
                serialNumber: 'GAS-1',
                unit: 'M3',
            });
        expect(response.status).toBe(201);
        return response.body as { id: string };
    }
});
