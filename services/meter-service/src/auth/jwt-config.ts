import { readFileSync } from 'node:fs';
import { createPublicKey } from 'node:crypto';

/**
 * JWT settings for validating access tokens issued by the Identity Service.
 *
 * The public key arrives as PEM text via a file (repo-root certs/ locally,
 * /run/secrets in containers) and its location is passed as an env var, never
 * committed (conventions §12 — same scheme as household-service's
 * configtree-based identity.jwt.public-key).
 */
export interface JwtConfig {
  issuer: string;
  audience: string;
  publicKeyPem: string;
}

export function loadJwtConfigFromEnv(env: NodeJS.ProcessEnv = process.env): JwtConfig {
  const issuer = env.IDENTITY_JWT_ISSUER;
  if (!issuer) {
    throw new Error('IDENTITY_JWT_ISSUER must be configured');
  }
  const audience = env.IDENTITY_JWT_AUDIENCE;
  if (!audience) {
    throw new Error('IDENTITY_JWT_AUDIENCE must be configured');
  }
  const publicKeyPath = env.IDENTITY_JWT_PUBLIC_KEY_PATH;
  if (!publicKeyPath) {
    throw new Error('IDENTITY_JWT_PUBLIC_KEY_PATH must be configured');
  }
  return {
    issuer,
    audience,
    publicKeyPem: readPublicKeyPem(publicKeyPath),
  };
}

function readPublicKeyPem(path: string): string {
  const pem = readFileSync(path, 'utf8');
  if (!pem.includes('BEGIN PUBLIC KEY')) {
    throw new Error(`Public key at ${path} is not PEM-encoded public key material`);
  }
  return pem;
}

/** Exposed for tests and startup-time validation of the configured key. */
export function parsePublicKey(pem: string) {
  return createPublicKey(pem);
}
