package com.meterhub.identity.adapters.outbound.persistence;

import com.meterhub.identity.domain.model.RevokedAccessToken;
import com.meterhub.identity.jooq.Tables;
import com.meterhub.identity.jooq.tables.records.RevokedAccessTokensRecord;
import com.meterhub.identity.ports.outbound.RevokedAccessTokenRepository;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public class RevokedAccessTokenRepositoryAdapter implements RevokedAccessTokenRepository {
    private final DSLContext dsl;

    public RevokedAccessTokenRepositoryAdapter(DSLContext dsl) {
        this.dsl = dsl;
    }

    @Override
    public RevokedAccessToken save(RevokedAccessToken token) {
        dsl.insertInto(Tables.REVOKED_ACCESS_TOKENS)
            .set(convert(token))
            .onConflictDoNothing()
            .execute();
        return token;
    }

    @Override
    public List<RevokedAccessToken> findAfter(OffsetDateTime since, int limit) {
        return dsl.selectFrom(Tables.REVOKED_ACCESS_TOKENS)
            .where(since == null
                ? org.jooq.impl.DSL.trueCondition()
                : Tables.REVOKED_ACCESS_TOKENS.REVOKED_AT.gt(since))
            .orderBy(Tables.REVOKED_ACCESS_TOKENS.REVOKED_AT.asc())
            .limit(limit)
            .fetch(this::convert);
    }

    @Override
    public int deleteExpired(OffsetDateTime now) {
        return dsl.deleteFrom(Tables.REVOKED_ACCESS_TOKENS)
            .where(Tables.REVOKED_ACCESS_TOKENS.EXPIRES_AT.lt(now))
            .execute();
    }

    private RevokedAccessTokensRecord convert(RevokedAccessToken token) {
        RevokedAccessTokensRecord record = new RevokedAccessTokensRecord();
        record.setJti(token.jti());
        record.setUserId(token.userId());
        record.setExpiresAt(token.expiresAt());
        record.setRevokedAt(token.revokedAt());
        return record;
    }

    private RevokedAccessToken convert(RevokedAccessTokensRecord record) {
        return new RevokedAccessToken(
            record.getJti(),
            record.getUserId(),
            record.getExpiresAt(),
            record.getRevokedAt()
        );
    }
}
