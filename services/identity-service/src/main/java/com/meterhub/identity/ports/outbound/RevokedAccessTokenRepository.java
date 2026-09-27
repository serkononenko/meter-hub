package com.meterhub.identity.ports.outbound;

import com.meterhub.identity.domain.model.RevokedAccessToken;

import java.time.OffsetDateTime;
import java.util.List;

public interface RevokedAccessTokenRepository {

    RevokedAccessToken save(RevokedAccessToken token);

    List<RevokedAccessToken> findAfter(OffsetDateTime since, int limit);

    int deleteExpired(OffsetDateTime now);
}
