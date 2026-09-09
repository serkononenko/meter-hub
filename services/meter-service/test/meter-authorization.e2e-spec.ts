import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import {
  ALICE_HOUSEHOLD,
  BOB_HOUSEHOLD,
  bringHouseholdBack,
  mintToken,
  takeHouseholdDown,
} from './global-setup.js';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const UNKNOWN_HOUSEHOLD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const UNKNOWN_METER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

/**
 * Cross-user authorization e2e (5.4): exercises the ownership checks through
 * the HTTP surface, with the household service stood in by the shared owner-
 * scoped stub (200 for the subject's own household, 404 otherwise).
 */
describe('Meter authorization (e2e)', () => {
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

  it("rejects creating a meter in someone else's household with HOUSEHOLD_NOT_FOUND", async () => {
    const bob = await mintToken({ subject: BOB });

    const created = await request(app.getHttpServer())
      .post('/api/v1/meters')
      .set('Authorization', `Bearer ${bob}`)
      .send({
        householdId: ALICE_HOUSEHOLD,
        type: 'ELECTRICITY',
        name: 'Sneaky meter',
        serialNumber: 'SN-1',
        unit: 'KWH',
      });

    expect(created.status).toBe(404);
    expect(created.headers['content-type']).toContain('application/problem+json');
    expect(created.body).toMatchObject({ code: 'HOUSEHOLD_NOT_FOUND', status: 404 });
  });

  it("rejects listing meters of someone else's household with the same 404 as an unknown one", async () => {
    const bob = await mintToken({ subject: BOB });

    const foreign = await request(app.getHttpServer())
      .get('/api/v1/meters')
      .query({ householdId: ALICE_HOUSEHOLD })
      .set('Authorization', `Bearer ${bob}`);
    const unknown = await request(app.getHttpServer())
      .get('/api/v1/meters')
      .query({ householdId: UNKNOWN_HOUSEHOLD })
      .set('Authorization', `Bearer ${bob}`);

    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    // Enumeration-safe: identical problem bodies (request-scoped fields aside).
    expect(stableProblem(unknown.body)).toEqual(stableProblem(foreign.body));
  });

  it('lets the owner create and list meters for their own household', async () => {
    const alice = await mintToken({ subject: ALICE });

    const created = await request(app.getHttpServer())
      .post('/api/v1/meters')
      .set('Authorization', `Bearer ${alice}`)
      .send({
        householdId: ALICE_HOUSEHOLD,
        type: 'COLD_WATER',
        name: 'Kitchen water meter',
        serialNumber: 'WT-77',
        unit: 'M3',
      });

    expect(created.status).toBe(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/meters')
      .query({ householdId: ALICE_HOUSEHOLD })
      .set('Authorization', `Bearer ${alice}`);

    expect(list.status).toBe(200);
    expect(list.body.map((m: { id: string }) => m.id)).toContain(created.body.id);
  });

  it("lets Bob manage meters in Bob's own household", async () => {
    const bob = await mintToken({ subject: BOB });

    const created = await request(app.getHttpServer())
      .post('/api/v1/meters')
      .set('Authorization', `Bearer ${bob}`)
      .send({
        householdId: BOB_HOUSEHOLD,
        type: 'GAS',
        name: "Bob's gas meter",
        serialNumber: 'BG-1',
        unit: 'M3',
      });

    expect(created.status).toBe(201);
  });

  it("hides someone else's meter behind the same 404 as an unknown meter (get)", async () => {
    const alice = await mintToken({ subject: ALICE });
    const created = await createMeter(alice, ALICE_HOUSEHOLD);
    const bob = await mintToken({ subject: BOB });

    const foreign = await request(app.getHttpServer())
      .get(`/api/v1/meters/${created.id}`)
      .set('Authorization', `Bearer ${bob}`);
    const unknown = await request(app.getHttpServer())
      .get(`/api/v1/meters/${UNKNOWN_METER}`)
      .set('Authorization', `Bearer ${bob}`);

    expect(foreign.status).toBe(404);
    expect(foreign.body.code).toBe('METER_NOT_FOUND');
    expect(stableProblem(unknown.body)).toEqual(stableProblem(foreign.body));
  });

  it("blocks patching someone else's meter", async () => {
    const alice = await mintToken({ subject: ALICE });
    const created = await createMeter(alice, ALICE_HOUSEHOLD);
    const bob = await mintToken({ subject: BOB });

    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/meters/${created.id}`)
      .set('Authorization', `Bearer ${bob}`)
      .send({ name: 'Bob was here' });

    expect(patched.status).toBe(404);
    expect(patched.body.code).toBe('METER_NOT_FOUND');

    // The meter is untouched.
    const aliceAgain = await mintToken({ subject: ALICE });
    const readBack = await request(app.getHttpServer())
      .get(`/api/v1/meters/${created.id}`)
      .set('Authorization', `Bearer ${aliceAgain}`);
    expect(readBack.body.name).toBe('Cross-user meter');
  });

  it('answers 502 when the household service is unreachable', async () => {
    const alice = await mintToken({ subject: ALICE });
    await takeHouseholdDown();
    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/meters')
        .query({ householdId: ALICE_HOUSEHOLD })
        .set('Authorization', `Bearer ${alice}`);

      expect(response.status).toBe(502);
      expect(response.body.code).toBe('HOUSEHOLD_SERVICE_UNAVAILABLE');
    } finally {
      await bringHouseholdBack();
    }
  });

  async function createMeter(token: string, householdId: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/meters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        householdId,
        type: 'ELECTRICITY',
        name: 'Cross-user meter',
        serialNumber: 'CU-1',
        unit: 'KWH',
      });
    expect(response.status).toBe(201);
    return response.body as { id: string };
  }
});

/** Problem body without request-scoped fields, for enumeration-safety diffs. */
function stableProblem(body: Record<string, unknown>) {
  const { correlationId: _c, instance: _i, ...rest } = body;
  return rest;
}
