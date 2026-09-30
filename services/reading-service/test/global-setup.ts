import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer, type Server, type IncomingMessage, type ServerResponse} from 'node:http';
import {generateKeyPairSync} from 'node:crypto';
import {beforeAll, afterAll} from 'vitest';
import jwt from 'jsonwebtoken';

/**
 * Global e2e setup: mints an RSA key pair for the run, points the service at
 * its public half, and runs stand-ins for the two services cross-service
 * authorization (6.5, A3) talks to:
 *
 * - meter-service stand-in answering GET /api/v1/meters/{id}: 200 with the
 *   meter (including its householdId) when the token's subject can see the
 *   meter, 404 otherwise (unknown or foreign).
 * - household-service stand-in answering the internal access verdict
 *   (GET /api/v1/internal/household-access): the caller's role for their
 *   household, `{exists: false}` otherwise.
 */
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

/** Meter owned by the ALICE test subject. */
export const ALICE_METER = '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01';
/** Meter owned by the BOB test subject. */
export const BOB_METER = 'e1673cfb-b055-4eff-a68b-2ec731660607';
/** Household the ALICE_METER belongs to. */
export const ALICE_HOUSEHOLD = 'aaaa1111-1111-4111-8111-111111111111';
/** Household the BOB_METER belongs to. */
export const BOB_HOUSEHOLD = 'bbbb2222-2222-4222-8222-222222222222';

const {privateKey, publicKey: publicKeyPem} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {type: 'spki', format: 'pem'},
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
});

let meterServer: Server;
let householdServer: Server;

beforeAll(async () => {
    const path = join(tmpdir(), `reading-service-e2e-${process.pid}.pem`);
    writeFileSync(path, publicKeyPem);
    process.env.IDENTITY_JWT_ISSUER = 'identity-service';
    process.env.IDENTITY_JWT_AUDIENCE = 'meterhub-api';
    process.env.IDENTITY_JWT_PUBLIC_KEY_PATH = path;

    meterServer = createServer(meterStubHandler);
    await listenOn(meterServer, 'meter');
    householdServer = createServer(householdStubHandler);
    await listenOn(householdServer, 'household');
}, 30_000);

afterAll(async () => {
    await new Promise<void>((resolve) => meterServer?.close(() => resolve()));
    await new Promise<void>((resolve) => householdServer?.close(() => resolve()));
});

/**
 * Listens on an ephemeral port the first time and re-uses that same port on
 * restarts: the service resolves `*_SERVICE_URL` from its config snapshot,
 * so a restart on a different port would leave it dialing the dead one.
 */
async function listenOn(server: Server, which: 'meter' | 'household'): Promise<void> {
    const envKey = which === 'meter' ? 'METER_SERVICE_URL' : 'HOUSEHOLD_SERVICE_URL';
    const previous = process.env[envKey];
    const port = previous
        ? Number(new URL(previous).port)
        : 0;
    await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
    process.env[envKey] = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

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
 * Temporarily takes both stand-ins down so callers see a connection failure
 * and the service must fail closed. Restart with bringServicesBack().
 */
export async function takeMeterDown(): Promise<void> {
    await new Promise<void>((resolve) => meterServer.close(() => resolve()));
}

export async function bringMeterBack(): Promise<void> {
    await listenOn(meterServer, 'meter');
}

export async function takeHouseholdDown(): Promise<void> {
    await new Promise<void>((resolve) => householdServer.close(() => resolve()));
}

export async function bringHouseholdBack(): Promise<void> {
    await listenOn(householdServer, 'household');
}

/** Meter ownership per meter, mirroring meter-service: which subject's
 * household the meter belongs to. */
const OWNED: Record<string, string> = {
    [ALICE_METER]: ALICE,
    [BOB_METER]: BOB,
};

/** Household each owner's meters live in. */
const OWNER_HOUSEHOLD: Record<string, string> = {
    [ALICE]: ALICE_HOUSEHOLD,
    [BOB]: BOB_HOUSEHOLD,
};

/**
 * Registers a meter with the stand-in so a test can use its own fresh meter
 * (the shared e2e database is not reset between runs, and the cumulative-
 * meter rule compares against previously stored readings). The meter is
 * registered under the given owner's household.
 */
export function registerMeter(meterId: string, owner: string): string {
    OWNED[meterId] = owner;
    return meterId;
}

/**
 * Roles per (household, subject), mirroring the membership model: owners
 * and members may write readings, viewers may only read. Any other pair is
 * a non-member.
 */
const ROLES: Record<string, string> = {
    [`${ALICE_HOUSEHOLD}:${ALICE}`]: 'OWNER',
    [`${BOB_HOUSEHOLD}:${BOB}`]: 'OWNER',
};

/** Grants subject a role in the household for the current run. */
export function grantRole(householdId: string, subject: string, role: 'MEMBER' | 'VIEWER'): void {
    ROLES[`${householdId}:${subject}`] = role;
}

/** Removes subject's membership in the household for the current run. */
export function revokeMembership(householdId: string, subject: string): void {
    delete ROLES[`${householdId}:${subject}`];
}

function meterStubHandler(request: IncomingMessage, response: ServerResponse): void {
    const match = /^\/api\/v1\/meters\/([0-9a-f-]{36})(\?.*)?$/.exec(request.url ?? '');
    const meterId = match?.[1];
    const subject = subjectOf(request.headers.authorization);
    const owner = meterId !== undefined ? OWNED[meterId] : undefined;
    const householdId = owner !== undefined ? OWNER_HOUSEHOLD[owner] : undefined;
    // Visible to the owner, and (for the role-aware coverage) to a
    // subject holding any role in the meter's household — meter-service
    // itself only checks visibility; the role verdict decides read/write.
    const visible = meterId !== undefined && householdId !== undefined && subject !== null
        && (OWNED[meterId] === subject || ROLES[`${householdId}:${subject}`] !== undefined);

    if (!visible) {
        response.writeHead(404, {'Content-Type': 'application/json'});
        response.end(JSON.stringify({code: 'METER_NOT_FOUND', status: 404}));
        return;
    }

    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({
        id: meterId,
        householdId,
        type: 'ELECTRICITY',
        name: 'Test meter',
        serialNumber: 'E2E-1',
        unit: 'KWH',
        status: 'ACTIVE',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
    }));
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
