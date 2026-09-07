package com.meterhub.gateway.config;

import java.security.interfaces.RSAPublicKey;

/**
 * Public half of the identity service's RSA key pair, used to verify JWT
 * signatures at the gateway.
 */
public record RsaKeyMaterial(RSAPublicKey publicKey) {
}
