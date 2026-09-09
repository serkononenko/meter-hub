import { generateKeyPair, SignJWT, exportSPKI } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { parsePublicKey } from './jwt-config.js';
import { JwtVerifier, TokenRejection } from './jwt-verifier.js';

/**
 * Generates an RSA key pair in memory and points the verifier at its public
 * half, so tests can mint both valid and deliberately broken tokens without
 * key material on disk.
 */
async function verifierWithKey(): Promise<{ verifier: JwtVerifier; privateKey: CryptoKey }> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
  const spki = await exportSPKI(publicKey);
  const verifier = new JwtVerifier();
  await verifier.configure({
    issuer: 'identity-service',
    audience: 'meterhub-api',
    publicKeyPem: spki,
  });
  return { verifier, privateKey };
}

describe('JwtVerifier', () => {
  let verifier: JwtVerifier;
  let privateKey: CryptoKey;

  beforeAll(async () => {
    const setup = await verifierWithKey();
    verifier = setup.verifier;
    privateKey = setup.privateKey;
  });

  it('accepts a well-formed token with the expected claims', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('identity-service')
      .setSubject('11111111-1111-4111-8111-111111111111')
      .setAudience('meterhub-api')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    const user = await verifier.verify(`Bearer ${token}`);

    expect(user.userId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('rejects a missing Authorization header as MISSING_TOKEN', async () => {
    await expect(verifier.verify(undefined)).rejects.toBe(TokenRejection.MISSING_TOKEN);
  });

  it('rejects a non-bearer Authorization header as MALFORMED_TOKEN', async () => {
    await expect(verifier.verify('Basic dXNlcjpwYXNz')).rejects.toBe(TokenRejection.MALFORMED_TOKEN);
    await expect(verifier.verify('Bearer')).rejects.toBe(TokenRejection.MALFORMED_TOKEN);
  });

  it('rejects a garbage token as INVALID_TOKEN', async () => {
    await expect(verifier.verify('Bearer not-a-jwt')).rejects.toBe(TokenRejection.INVALID_TOKEN);
  });

  it('rejects a token signed with the wrong key as INVALID_TOKEN', async () => {
    const wrongKeyPair = await generateKeyPair('RS256', { modulusLength: 2048 });
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('identity-service')
      .setAudience('meterhub-api')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(wrongKeyPair.privateKey);

    await expect(verifier.verify(`Bearer ${token}`)).rejects.toBe(TokenRejection.INVALID_TOKEN);
  });

  it('rejects tokens with the wrong issuer or audience', async () => {
    const wrongIssuer = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('some-other-service')
      .setAudience('meterhub-api')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    const wrongAudience = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('identity-service')
      .setAudience('some-other-audience')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(verifier.verify(`Bearer ${wrongIssuer}`)).rejects.toBe(TokenRejection.INVALID_TOKEN);
    await expect(verifier.verify(`Bearer ${wrongAudience}`)).rejects.toBe(
      TokenRejection.INVALID_TOKEN,
    );
  });

  it('rejects an expired token', async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('identity-service')
      .setAudience('meterhub-api')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(privateKey);

    await expect(verifier.verify(`Bearer ${expired}`)).rejects.toBe(TokenRejection.INVALID_TOKEN);
  });

  it('rejects a token without a subject claim', async () => {
    const noSubject = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('identity-service')
      .setAudience('meterhub-api')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(verifier.verify(`Bearer ${noSubject}`)).rejects.toBe(TokenRejection.INVALID_TOKEN);
  });
});

describe('parsePublicKey', () => {
  it('parses the PEM produced by jose key export', async () => {
    const { publicKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
    const spki = await exportSPKI(publicKey);
    expect(parsePublicKey(spki).type).toBe('public');
  });
});
