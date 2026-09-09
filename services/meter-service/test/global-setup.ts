import { beforeAll, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { exportSPKI, generateKeyPair, SignJWT, type CryptoKey } from 'jose';

/**
 * Global e2e setup: mints an RSA key pair for the run, points the service at
 * its public half, and runs a household-service stand-in so ownership checks
 * (5.4) have something owner-scoped to talk to. The stand-in answers like
 * household-service's GET /api/v1/households/{id}: 200 when the token's
 * subject owns the household, 404 otherwise (unknown or foreign).
 */
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

/** Household owned by the ALICE test subject. */
export const ALICE_HOUSEHOLD = 'aaaa1111-1111-4111-8111-111111111111';
/** Household owned by the BOB test subject. */
export const BOB_HOUSEHOLD = 'bbbb2222-2222-4222-8222-222222222222';

let privateKey: CryptoKey;
let householdServer: Server;

beforeAll(async () => {
  const { publicKey, privateKey: key } = await generateKeyPair('RS256', { modulusLength: 2048 });
  privateKey = key;
  const pem = await exportSPKI(publicKey);
  const path = join(tmpdir(), `meter-service-e2e-${process.pid}.pem`);
  writeFileSync(path, pem);
  process.env.IDENTITY_JWT_ISSUER = 'identity-service';
  process.env.IDENTITY_JWT_AUDIENCE = 'meterhub-api';
  process.env.IDENTITY_JWT_PUBLIC_KEY_PATH = path;

  householdServer = createServer(householdStubHandler);
  await new Promise<void>((resolve) => householdServer.listen(0, '127.0.0.1', resolve));
  const port = (householdServer.address() as { port: number }).port;
  process.env.HOUSEHOLD_SERVICE_URL = `http://127.0.0.1:${port}`;
}, 30_000);

afterAll(async () => {
  await new Promise<void>((resolve) => householdServer?.close(() => resolve()));
});

/** Mints a signed access token with full claim control. */
export async function mintToken(claims: {
  subject?: string;
  issuer?: string;
  audience?: string;
  issuedAt?: number;
  expiresAt?: number;
}): Promise<string> {
  if (!privateKey) {
    throw new Error('JWT test keys not initialized; run the global beforeAll first');
  }
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(claims.issuer ?? 'identity-service')
    .setSubject(claims.subject ?? ALICE)
    .setAudience(claims.audience ?? 'meterhub-api')
    .setIssuedAt(claims.issuedAt ?? now)
    .setExpirationTime(claims.expiresAt ?? now + 300)
    .sign(privateKey);
}

/**
 * Temporarily takes the household stand-in down so callers see a connection
 * failure and the service must fail closed. Restart with bringHouseholdBack().
 */
export async function takeHouseholdDown(): Promise<void> {
  await new Promise<void>((resolve) => householdServer.close(() => resolve()));
}

export async function bringHouseholdBack(): Promise<void> {
  await new Promise<void>((resolve) => householdServer.listen(0, '127.0.0.1', resolve));
  const port = (householdServer.address() as { port: number }).port;
  process.env.HOUSEHOLD_SERVICE_URL = `http://127.0.0.1:${port}`;
}

const OWNED: Record<string, string> = {
  [ALICE_HOUSEHOLD]: ALICE,
  [BOB_HOUSEHOLD]: BOB,
};

function householdStubHandler(
  request: { url?: string; headers: { authorization?: string } },
  response: { writeHead: (status: number, headers: object) => void; end: (body: string) => void },
): void {
  const match = /^\/api\/v1\/households\/([0-9a-f-]{36})(\?.*)?$/.exec(request.url ?? '');
  const householdId = match?.[1];
  const subject = subjectOf(request.headers.authorization);
  const owned = householdId !== undefined && OWNED[householdId] === subject;
  response.writeHead(owned ? 200 : 404, { 'Content-Type': 'application/json' });
  response.end(
    owned
      ? JSON.stringify({ id: householdId, name: 'Test household', createdAt: '2026-09-01T10:00:00Z' })
      : JSON.stringify({ code: 'HOUSEHOLD_NOT_FOUND', status: 404 }),
  );
}

/** Decodes (without verifying — this is a test stand-in) the token's `sub`. */
function subjectOf(authorization: string | undefined): string | null {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return null;
  }
  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }
  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    return (JSON.parse(json) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}
