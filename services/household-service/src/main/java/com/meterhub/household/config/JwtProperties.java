package com.meterhub.household.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * JWT settings for validating access tokens issued by the Identity Service.
 * The public key arrives as PEM text via the configtree, never from source control.
 */
@ConfigurationProperties(prefix = "identity.jwt")
public record JwtProperties(String issuer, String audience, String publicKey) {

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
