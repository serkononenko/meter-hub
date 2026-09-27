package com.meterhub.identity.domain.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A revoked access token, keyed by its {@code jti} claim. The row exists
 * only so the gateway's revocation cache can learn about the revocation —
 * identity itself never validates access tokens. {@code userId} is null
 * when the revocation could not be attributed (logout with an access token
 * but an unknown refresh token). Once {@code expiresAt} (the token's
 * original expiry) has passed, the row is dead weight: every validation
 * anywhere would reject the token on {@code exp} anyway, so the cleanup
 * drops it.
 */
public record RevokedAccessToken(
    UUID jti,
    UUID userId,
    OffsetDateTime expiresAt,
    OffsetDateTime revokedAt
) {
}
