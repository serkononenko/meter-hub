import { Injectable } from '@nestjs/common';
import { jwtVerify } from 'jose';
import type { JwtConfig } from './jwt-config.js';

/** Verified identity of the caller, taken from the access token's `sub`. */
export interface AuthenticatedUser {
  userId: string;
  /**
   * The raw token as presented, so downstream ownership checks can act on
   * behalf of the caller (identity propagation, service-boundaries).
   */
  accessToken: string;
}

/** Why a presented token was rejected; drives the 401 problem code. */
export enum TokenRejection {
  /** No Authorization header at all. */
  MISSING_TOKEN = 'MISSING_TOKEN',
  /** Authorization header present but not a Bearer token. */
  MALFORMED_TOKEN = 'MALFORMED_TOKEN',
  /** A Bearer token that failed signature, claims, or expiry validation. */
  INVALID_TOKEN = 'INVALID_TOKEN',
}

/**
 * Verifies RS256 access tokens against the Identity Service public key.
 *
 * Mirrors the checks the gateway and household-service perform (signature,
 * issuer, audience, expiry) so a token accepted anywhere is accepted here and
 * rejected tokens are rejected consistently — defense in depth, since the
 * gateway already validates at the edge.
 */
@Injectable()
export class JwtVerifier {
  private key?: CryptoKey;
  private issuer?: string;
  private audience?: string;

  /** Imports the configured public key. Called once at module init. */
  async configure(config: JwtConfig): Promise<void> {
    this.issuer = config.issuer;
    this.audience = config.audience;
    this.key = await importPublicKey(config.publicKeyPem);
  }

  /**
   * Verifies the presented bearer token and returns the caller identity.
   * Throws a {@link TokenRejection} so the guard can map the failure to the
   * UNAUTHORIZED vs INVALID_TOKEN problem responses.
   */
  async verify(authorizationHeader: string | undefined): Promise<AuthenticatedUser> {
    if (!this.key) {
      throw new Error('JwtVerifier was not configured with a public key');
    }
    if (!authorizationHeader) {
      throw TokenRejection.MISSING_TOKEN;
    }
    const [scheme, ...rest] = authorizationHeader.split(' ');
    const token = rest.join(' ');
    if (scheme.toLowerCase() !== 'bearer' || token.length === 0) {
      throw TokenRejection.MALFORMED_TOKEN;
    }
    let subject: unknown;
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256'],
      });
      subject = payload.sub;
    } catch {
      throw TokenRejection.INVALID_TOKEN;
    }
    if (typeof subject !== 'string' || subject.length === 0) {
      throw TokenRejection.INVALID_TOKEN;
    }
    return { userId: subject, accessToken: token };
  }
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  const spkiBase64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const spki = Buffer.from(spkiBase64, 'base64');
  return crypto.subtle.importKey(
    'spki',
    spki,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}
