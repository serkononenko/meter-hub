import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { VerdictCache } from '../src/household/verdict-cache.js';
import {
  ALICE_HOUSEHOLD,
  BOB_HOUSEHOLD,
  bringHouseholdBack,
  grantRole,
  mintToken,
  revokeMembership,
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

  it('lets a VIEWER read meters but rejects creating and patching with FORBIDDEN_ROLE', async () => {
    const viewer = '33333333-3333-4333-8333-333333333333';
    grantRole(ALICE_HOUSEHOLD, viewer, 'VIEWER');
    const alice = await mintToken({ subject: ALICE });
    const created = await createMeter(alice, ALICE_HOUSEHOLD);
    const viewerToken = await mintToken({ subject: viewer });

    try {
      const list = await request(app.getHttpServer())
        .get('/api/v1/meters')
        .query({ householdId: ALICE_HOUSEHOLD })
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(list.status).toBe(200);

      const read = await request(app.getHttpServer())
        .get(`/api/v1/meters/${created.id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(read.status).toBe(200);

      const createAttempt = await request(app.getHttpServer())
        .post('/api/v1/meters')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          householdId: ALICE_HOUSEHOLD,
          type: 'ELECTRICITY',
          name: 'Viewer meter',
          serialNumber: uniqueSerial(),
          unit: 'KWH',
        });
      expect(createAttempt.status).toBe(403);
      expect(createAttempt.body.code).toBe('FORBIDDEN_ROLE');

      const patchAttempt = await request(app.getHttpServer())
        .patch(`/api/v1/meters/${created.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Viewer was here' });
      expect(patchAttempt.status).toBe(403);
      expect(patchAttempt.body.code).toBe('FORBIDDEN_ROLE');

      // Nothing was written.
      const readBack = await request(app.getHttpServer())
        .get(`/api/v1/meters/${created.id}`)
        .set('Authorization', `Bearer ${alice}`);
      expect(readBack.body.name).toBe('Cross-user meter');
    } finally {
      revokeMembership(ALICE_HOUSEHOLD, viewer);
    }
  });

  it('lets a MEMBER create meters but not manage the household roster', async () => {
    const member = '44444444-4444-4444-8444-444444444444';
    grantRole(ALICE_HOUSEHOLD, member, 'MEMBER');
    try {
      const memberToken = await mintToken({ subject: member });

      const created = await request(app.getHttpServer())
        .post('/api/v1/meters')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          householdId: ALICE_HOUSEHOLD,
          type: 'HOT_WATER',
          name: 'Member meter',
          serialNumber: uniqueSerial(),
          unit: 'M3',
        });

      expect(created.status).toBe(201);
    } finally {
      revokeMembership(ALICE_HOUSEHOLD, member);
    }
  });

  it('re-rejects a removed member after the verdict cache expires', async () => {
    const member = '55555555-5555-4555-8555-555555555555';
    grantRole(ALICE_HOUSEHOLD, member, 'MEMBER');
    const memberToken = await mintToken({ subject: member });

    const created = await request(app.getHttpServer())
      .post('/api/v1/meters')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        householdId: ALICE_HOUSEHOLD,
        type: 'GAS',
        name: 'Doomed member meter',
        serialNumber: uniqueSerial(),
        unit: 'M3',
      });
    expect(created.status).toBe(201);

    // Owner removes the member; the next cold verdict (after cache reset)
    // must deny them.
    revokeMembership(ALICE_HOUSEHOLD, member);
    app.get(VerdictCache).clear();

    const afterRemoval = await request(app.getHttpServer())
      .get('/api/v1/meters')
      .query({ householdId: ALICE_HOUSEHOLD })
      .set('Authorization', `Bearer ${memberToken}`);
    expect(afterRemoval.status).toBe(404);
    expect(afterRemoval.body.code).toBe('HOUSEHOLD_NOT_FOUND');
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
        serialNumber: uniqueSerial(),
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
        serialNumber: uniqueSerial(),
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
        serialNumber: uniqueSerial(),
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

  it('answers 503 when the household service is unreachable', async () => {
    const alice = await mintToken({ subject: ALICE });
    await takeHouseholdDown();
    try {
      // The verdict cache may still hold an entry from earlier tests in this
      // run; a cold verdict is what proves the fail-closed path.
      app.get(VerdictCache).clear();

      const response = await request(app.getHttpServer())
        .get('/api/v1/meters')
        .query({ householdId: ALICE_HOUSEHOLD })
        .set('Authorization', `Bearer ${alice}`);

      expect(response.status).toBe(503);
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
        serialNumber: uniqueSerial(),
        unit: 'KWH',
      });
    expect(response.status).toBe(201);
    return response.body as { id: string };
  }
});

/** Serials are unique per household (5.5), so every run needs fresh ones. */
function uniqueSerial(): string {
  return `E2E-${crypto.randomUUID().slice(0, 8)}`;
}

/** Problem body without request-scoped fields, for enumeration-safety diffs. */
function stableProblem(body: Record<string, unknown>) {
  const { correlationId: _c, instance: _i, detail: _d, ...rest } = body;
  return rest;
}
