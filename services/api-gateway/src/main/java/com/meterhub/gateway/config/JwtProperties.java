package com.meterhub.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * JWT validation settings. Unlike the identity service, the gateway only
 * validates tokens, so no TTLs and no private key are needed here.
 *
 * <p>The public key arrives as a file via {@code spring.config.import} of a
 * {@code configtree} (local {@code ./certs/} directory in development, Docker
 * Compose secrets under {@code /run/secrets/} in containerized environments);
 * file names map to property names, so {@code identity.jwt.public-key}
 * contains the PEM text.
 */
@ConfigurationProperties(prefix = "identity.jwt")
public record JwtProperties(
    String issuer,
    String audience,
    String publicKey
) {
    public JwtProperties {
        if (issuer == null || issuer.isBlank()) {
            throw new IllegalStateException("identity.jwt.issuer must be configured");
        }
        if (audience == null || audience.isBlank()) {
            throw new IllegalStateException("identity.jwt.audience must be configured");
        }
        if (publicKey == null || publicKey.isBlank()) {
            throw new IllegalStateException("identity.jwt.public-key must be configured (PEM)");
        }
    }
}
