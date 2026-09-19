import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer, type Server, type IncomingMessage, type ServerResponse} from 'node:http';
import {generateKeyPairSync} from 'node:crypto';
import {beforeAll, afterAll} from 'vitest';
import jwt from 'jsonwebtoken';

/**
 * Global e2e setup: mints an RSA key pair for the run, points the service at
 * its public half, and runs a meter-service stand-in so cross-service
 * authorization (6.5) has something owner-scoped to talk to. The stand-in
 * answers like meter-service's GET /api/v1/meters/{id}: 200 when the token's
 * subject owns the meter, 404 otherwise (unknown or foreign).
 */
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

/** Meter owned by the ALICE test subject. */
export const ALICE_METER = '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01';
/** Meter owned by the BOB test subject. */
export const BOB_METER = 'e1673cfb-b055-4eff-a68b-2ec731660607';

const {privateKey, publicKey: publicKeyPem} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {type: 'spki', format: 'pem'},
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
});

let meterServer: Server;

beforeAll(async () => {
    const path = join(tmpdir(), `reading-service-e2e-${process.pid}.pem`);
    writeFileSync(path, publicKeyPem);
    process.env.IDENTITY_JWT_ISSUER = 'identity-service';
    process.env.IDENTITY_JWT_AUDIENCE = 'meterhub-api';
    process.env.IDENTITY_JWT_PUBLIC_KEY_PATH = path;

    meterServer = createServer(meterStubHandler);
    await new Promise<void>((resolve) => meterServer.listen(0, '127.0.0.1', resolve));
    const port = (meterServer.address() as { port: number }).port;
    process.env.METER_SERVICE_URL = `http://127.0.0.1:${port}`;
}, 30_000);

afterAll(async () => {
    await new Promise<void>((resolve) => meterServer?.close(() => resolve()));
});

interface TokenClaims {
    subject?: string;
    issuer?: string;
    audience?: string;
    issuedAt?: number;
    expiresAt?: number;
}

/** Mints a signed access token with full claim control. */
export function mintToken(claims: TokenClaims = {}): string {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
        {
            iss: claims.issuer ?? 'identity-service',
            sub: claims.subject ?? ALICE,
            iat: claims.issuedAt ?? now,
            exp: claims.expiresAt ?? now + 300,
        },
        privateKey,
        {algorithm: 'RS256', audience: claims.audience ?? 'meterhub-api'},
    );
}

/**
 * Temporarily takes the meter stand-in down so callers see a connection
 * failure and the service must fail closed. Restart with bringMeterBack().
 */
export async function takeMeterDown(): Promise<void> {
    await new Promise<void>((resolve) => meterServer.close(() => resolve()));
}

export async function bringMeterBack(): Promise<void> {
    await new Promise<void>((resolve) => meterServer.listen(0, '127.0.0.1', resolve));
    const port = (meterServer.address() as { port: number }).port;
    process.env.METER_SERVICE_URL = `http://127.0.0.1:${port}`;
}

const OWNED: Record<string, string> = {
    [ALICE_METER]: ALICE,
    [BOB_METER]: BOB,
};

/**
 * Registers a meter with the stand-in so a test can use its own fresh meter
 * (the shared e2e database is not reset between runs, and the cumulative-
 * meter rule compares against previously stored readings).
 */
export function registerMeter(meterId: string, owner: string): string {
    OWNED[meterId] = owner;
    return meterId;
}

function meterStubHandler(request: IncomingMessage, response: ServerResponse): void {
    const match = /^\/api\/v1\/meters\/([0-9a-f-]{36})(\?.*)?$/.exec(request.url ?? '');
    const meterId = match?.[1];
    const subject = subjectOf(request.headers.authorization);
    const owned = meterId !== undefined && OWNED[meterId] === subject;
    response.writeHead(owned ? 200 : 404, {'Content-Type': 'application/json'});
    response.end(
        owned
            ? JSON.stringify({
                id: meterId,
                householdId: 'aaaa1111-1111-4111-8111-111111111111',
                type: 'ELECTRICITY',
                name: 'Test meter',
                serialNumber: 'E2E-1',
                unit: 'KWH',
                status: 'ACTIVE',
                createdAt: '2026-09-01T10:00:00Z',
                updatedAt: '2026-09-01T10:00:00Z',
            })
            : JSON.stringify({code: 'METER_NOT_FOUND', status: 404}),
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
