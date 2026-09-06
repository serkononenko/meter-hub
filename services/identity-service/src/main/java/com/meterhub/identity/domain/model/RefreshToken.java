package com.meterhub.identity.domain.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A single-use opaque refresh token. Only the SHA-256 digest of the token
 * value is ever stored ({@code tokenHash}); the raw value exists only in the
 * response issued to the client. A token is unusable once {@code revokedAt}
 * is set or {@code expiresAt} has passed, and is consumed (revoked) on every
 * successful refresh, which is what makes rotation work.
 */
public record RefreshToken(
    UUID id,
    UUID userId,
    String tokenHash,
    OffsetDateTime expiresAt,
    OffsetDateTime revokedAt,
    OffsetDateTime createdAt
) {
}
