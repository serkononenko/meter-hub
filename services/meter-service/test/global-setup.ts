import { beforeAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportSPKI, generateKeyPair, SignJWT, type CryptoKey } from 'jose';

/**
 * Global e2e JWT setup: mints an RSA key pair for the run, points the service
 * at its public half, and exposes the private half for token minting.
 */
let privateKey: CryptoKey;

beforeAll(async () => {
  const { publicKey, privateKey: key } = await generateKeyPair('RS256', { modulusLength: 2048 });
  privateKey = key;
  const pem = await exportSPKI(publicKey);
  const path = join(tmpdir(), `meter-service-e2e-${process.pid}.pem`);
  writeFileSync(path, pem);
  process.env.IDENTITY_JWT_ISSUER = 'identity-service';
  process.env.IDENTITY_JWT_AUDIENCE = 'meterhub-api';
  process.env.IDENTITY_JWT_PUBLIC_KEY_PATH = path;
}, 30_000);

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
    .setSubject(claims.subject ?? '11111111-1111-4111-8111-111111111111')
    .setAudience(claims.audience ?? 'meterhub-api')
    .setIssuedAt(claims.issuedAt ?? now)
    .setExpirationTime(claims.expiresAt ?? now + 300)
    .sign(privateKey);
}
