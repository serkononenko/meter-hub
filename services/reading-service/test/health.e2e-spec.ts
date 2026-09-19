import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {AppModule} from '../src/app.module.js';

/**
 * Bootstrap e2e (6.1): the HTTP surface comes up against the real Prisma
 * wiring and the local reading_db.
 */
describe('Health (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('reports prisma connectivity with a correlation id', async () => {
        const response = await request(app.getHttpServer())
            .get('/health')
            .set('X-Correlation-ID', '7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(response.body.details.prisma.status).toBe('up');
        expect(response.headers['x-correlation-id']).toBe('7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10');
    });

    it('echoes a generated correlation id when none is supplied', async () => {
        const response = await request(app.getHttpServer()).get('/health');

        expect(response.status).toBe(200);
        expect(response.headers['x-correlation-id']).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
    });

    afterAll(async () => {
        await app.close();
    });
});
