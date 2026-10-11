import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer, type Server, type IncomingMessage, type ServerResponse} from 'node:http';
import {generateKeyPairSync} from 'node:crypto';
import {beforeAll, afterAll} from 'vitest';
import jwt from 'jsonwebtoken';

export const ALICE = '11111111-1111-4111-8111-111111111111';
export const BOB = '22222222-2222-4222-8222-222222222222';
export const ADMIN = '99999999-9999-4999-8999-999999999999';

export const ALICE_HOUSEHOLD = 'aaaa1111-1111-4111-8111-111111111111';
export const BOB_HOUSEHOLD = 'bbbb2222-2222-4222-8222-222222222222';

const {privateKey, publicKey: publicKeyPem} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {type: 'spki', format: 'pem'},
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
});

let householdServer: Server;
let meterServer: Server;

beforeAll(async () => {
    const path = join(tmpdir(), `provider-service-e2e-${process.pid}.pem`);
    writeFileSync(path, publicKeyPem);
    process.env.IDENTITY_JWT_ISSUER = 'identity-service';
    process.env.IDENTITY_JWT_AUDIENCE = 'meterhub-api';
    process.env.IDENTITY_JWT_PUBLIC_KEY_PATH = path;
    // The specs write real outbox rows; an unreachable broker keeps the relay from publishing them to a
    // developer's running Kafka (events just stay queued, which is what the specs assert on).
    process.env.KAFKA_BROKERS = '127.0.0.1:1';
    // Specs drive relay rounds explicitly; a background timer racing them made the outbox assertions flaky.
    process.env.OUTBOX_RELAY_ENABLED = 'false';

    householdServer = createServer(householdStubHandler);
    await new Promise<void>((resolve) => householdServer.listen(0, '127.0.0.1', resolve));
    process.env.HOUSEHOLD_SERVICE_URL = `http://127.0.0.1:${(householdServer.address() as { port: number }).port}`;

    meterServer = createServer(meterStubHandler);
    await new Promise<void>((resolve) => meterServer.listen(0, '127.0.0.1', resolve));
    process.env.METER_SERVICE_URL = `http://127.0.0.1:${(meterServer.address() as { port: number }).port}`;
}, 30_000);

afterAll(async () => {
    await new Promise<void>((resolve) => householdServer?.close(() => resolve()));
    await new Promise<void>((resolve) => meterServer?.close(() => resolve()));
});

export async function takeMeterDown(): Promise<void> {
    await new Promise<void>((resolve) => meterServer.close(() => resolve()));
}

export async function bringMeterBack(): Promise<void> {
    const port = Number(new URL(process.env.METER_SERVICE_URL!).port);
    await new Promise<void>((resolve) => meterServer.listen(port, '127.0.0.1', resolve));
}

interface TokenClaims {
    subject?: string;
    roles?: string[];
}

export function mintToken({subject = ALICE, roles = ['USER']}: TokenClaims = {}): string {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
        {iss: 'identity-service', sub: subject, roles, iat: now, exp: now + 300},
        privateKey,
        {algorithm: 'RS256', audience: 'meterhub-api'},
    );
}

const ROLES: Record<string, string> = {
    [`${ALICE_HOUSEHOLD}:${ALICE}`]: 'OWNER',
    [`${BOB_HOUSEHOLD}:${BOB}`]: 'OWNER',
};

export function grantRole(householdId: string, subject: string, role: 'OWNER' | 'MEMBER' | 'VIEWER'): void {
    ROLES[`${householdId}:${subject}`] = role;
}

export function revokeMembership(householdId: string, subject: string): void {
    delete ROLES[`${householdId}:${subject}`];
}

const METERS: Record<string, string> = {};

export function registerMeter(meterId: string, householdId: string): string {
    METERS[meterId] = householdId;
    return meterId;
}

export function forgetMeters(): void {
    for (const meterId of Object.keys(METERS)) {
        delete METERS[meterId];
    }
}

// Mirrors meter-service: a meter is visible to a caller who holds any role in its household.
function meterStubHandler(request: IncomingMessage, response: ServerResponse): void {
    const meterId = /^\/api\/v1\/meters\/([0-9a-f-]{36})$/.exec(request.url ?? '')?.[1];
    const householdId = meterId ? METERS[meterId] : undefined;
    const subject = subjectOf(request.headers.authorization);
    const visible = householdId !== undefined && subject !== null && ROLES[`${householdId}:${subject}`] !== undefined;

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

function subjectOf(authorization: string | undefined): string | null {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    const payload = token?.split('.')[1];

    if (!payload) {
        return null;
    }

    try {
        return (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string }).sub ?? null;
    } catch {
        return null;
    }
}

function householdStubHandler(request: IncomingMessage, response: ServerResponse): void {
    const match = /^\/api\/v1\/internal\/household-access\?householdId=([0-9a-f-]{36})&userId=([0-9a-f-]{36})$/
        .exec(request.url ?? '');
    const role = match ? ROLES[`${match[1]}:${match[2]}`] : undefined;

    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify(role ? {exists: true, role} : {exists: false}));
}
