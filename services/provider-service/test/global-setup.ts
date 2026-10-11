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

beforeAll(async () => {
    const path = join(tmpdir(), `provider-service-e2e-${process.pid}.pem`);
    writeFileSync(path, publicKeyPem);
    process.env.IDENTITY_JWT_ISSUER = 'identity-service';
    process.env.IDENTITY_JWT_AUDIENCE = 'meterhub-api';
    process.env.IDENTITY_JWT_PUBLIC_KEY_PATH = path;

    householdServer = createServer(householdStubHandler);
    await new Promise<void>((resolve) => householdServer.listen(0, '127.0.0.1', resolve));
    process.env.HOUSEHOLD_SERVICE_URL = `http://127.0.0.1:${(householdServer.address() as { port: number }).port}`;
}, 30_000);

afterAll(async () => {
    await new Promise<void>((resolve) => householdServer?.close(() => resolve()));
});

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

function householdStubHandler(request: IncomingMessage, response: ServerResponse): void {
    const match = /^\/api\/v1\/internal\/household-access\?householdId=([0-9a-f-]{36})&userId=([0-9a-f-]{36})$/
        .exec(request.url ?? '');
    const role = match ? ROLES[`${match[1]}:${match[2]}`] : undefined;

    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify(role ? {exists: true, role} : {exists: false}));
}
