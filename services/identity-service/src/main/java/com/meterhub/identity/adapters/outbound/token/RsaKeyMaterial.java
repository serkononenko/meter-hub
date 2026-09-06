package com.meterhub.identity.adapters.outbound.token;

import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;

/**
 * The RS256 signing key pair, loaded once at startup from PEM material
 * supplied through configuration (environment). Nothing is ever read from
 * source control, and the PEM strings are not retained.
 */
public record RsaKeyMaterial(RSAPrivateKey privateKey, RSAPublicKey publicKey) {
}
