package com.meterhub.identity.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * JWT settings bound from the {@code identity.jwt} configuration namespace.
 * Environment variables map via relaxed binding: IDENTITY_JWT_ISSUER,
 * IDENTITY_JWT_AUDIENCE, IDENTITY_JWT_ACCESS_TOKEN_TTL. The PEM key material
 * is not an env var — it arrives as files named after these properties
 * (identity.jwt.private-key / identity.jwt.public-key) via the configtree
 * imports in application.yaml, from secret mounts in production or ./certs
 * locally (never committed to source control).
 */
@ConfigurationProperties(prefix = "identity.jwt")
public record JwtProperties(
    String issuer,
    String audience,
    Duration accessTokenTtl,
    String privateKey,
    String publicKey
) {

    public JwtProperties {
        if (issuer == null || issuer.isBlank()) {
            throw new IllegalStateException("identity.jwt.issuer must be configured");
        }
        if (audience == null || audience.isBlank()) {
            throw new IllegalStateException("identity.jwt.audience must be configured");
        }
        if (accessTokenTtl == null || accessTokenTtl.isZero() || accessTokenTtl.isNegative()) {
            throw new IllegalStateException("identity.jwt.access-token-ttl must be positive");
        }
    }
}
