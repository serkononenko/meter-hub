import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer, type Server, type IncomingMessage, type ServerResponse} from 'node:http';
import {generateKeyPairSync} from 'node:crypto';
import {beforeAll, afterAll} from 'vitest';
import jwt from 'jsonwebtoken';

/**
 * Global e2e setup: mints an RSA key pair for the run, points the service at
 * its public half, and runs a household-service stand-in so the role-aware
 * authorization (A3) has something membership-scoped to talk to. The stand-in
 * answers like household-service's internal access verdict
 * (GET /api/v1/internal/household-access): the caller's role for their own
 * household, `{exists: false}` otherwise (unknown or foreign).
 */
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

/** Household owned by the ALICE test subject. */
export const ALICE_HOUSEHOLD = 'aaaa1111-1111-4111-8111-111111111111';
/** Household owned by the BOB test subject. */
export const BOB_HOUSEHOLD = 'bbbb2222-2222-4222-8222-222222222222';

const {privateKey, publicKey: publicKeyPem} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {type: 'spki', format: 'pem'},
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
});

let householdServer: Server;

beforeAll(async () => {
    const path = join(tmpdir(), `meter-service-e2e-${process.pid}.pem`);
    writeFileSync(path, publicKeyPem);
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

/**
 * Roles per (household, subject), mirroring the A3 membership model: owners
 * and members may write, the viewer fixture may only read. Any other pair is
 * a non-member.
 */
const ROLES: Record<string, string> = {
    [`${ALICE_HOUSEHOLD}:${ALICE}`]: 'OWNER',
    [`${BOB_HOUSEHOLD}:${BOB}`]: 'OWNER',
};

/** Grants a subject a role in a household for the current run. */
export function grantRole(householdId: string, subject: string, role: 'MEMBER' | 'VIEWER'): void {
    ROLES[`${householdId}:${subject}`] = role;
}

/** Removes a subject's membership in a household for the current run. */
export function revokeMembership(householdId: string, subject: string): void {
    delete ROLES[`${householdId}:${subject}`];
}

function householdStubHandler(request: IncomingMessage, response: ServerResponse): void {
    const match = /^\/api\/v1\/internal\/household-access\?householdId=([0-9a-f-]{36})&userId=([0-9a-f-]{36})$/
        .exec(request.url ?? '');
    const householdId = match?.[1];
    const userId = match?.[2];
    const role = householdId !== undefined && userId !== undefined
        ? ROLES[`${householdId}:${userId}`]
        : undefined;

    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(
        role
            ? JSON.stringify({exists: true, role})
            : JSON.stringify({exists: false}),
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
