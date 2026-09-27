package com.meterhub.gateway.auth;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Rejects access tokens whose {@code jti} is in the revocation cache — i.e.
 * tokens whose session was closed (logout with a Bearer token) before their
 * 15-minute TTL ran out. Tokens without a jti (issued before A4) pass: they
 * predate revocation and simply live out their TTL.
 */
public class JwtRevocationValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error REVOKED = new OAuth2Error(
        "invalid_token",
        "Access token has been revoked",
        null
    );

    private final RevocationCache cache;

    public JwtRevocationValidator(RevocationCache cache) {
        this.cache = cache;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        return cache.isRevoked(token.getId())
            ? OAuth2TokenValidatorResult.failure(REVOKED)
            : OAuth2TokenValidatorResult.success();
    }
}
