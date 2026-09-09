package com.meterhub.household.config;

import java.security.interfaces.RSAPublicKey;

/**
 * RSA key material for verifying access tokens issued by the Identity Service.
 * The Household Service never signs tokens, so only the public key is kept.
 */
public record RsaKeyMaterial(RSAPublicKey publicKey) {
}
