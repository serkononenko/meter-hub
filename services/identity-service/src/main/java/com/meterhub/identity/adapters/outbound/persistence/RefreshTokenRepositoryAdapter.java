package com.meterhub.identity.adapters.outbound.persistence;

import com.meterhub.identity.domain.model.RefreshToken;
import com.meterhub.identity.jooq.Tables;
import com.meterhub.identity.jooq.tables.records.RefreshTokensRecord;
import com.meterhub.identity.ports.outbound.RefreshTokenRepository;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public class RefreshTokenRepositoryAdapter implements RefreshTokenRepository {
    private final DSLContext dsl;

    public RefreshTokenRepositoryAdapter(DSLContext dsl) {
        this.dsl = dsl;
    }

    @Override
    public RefreshToken save(RefreshToken token) {
        dsl.insertInto(Tables.REFRESH_TOKENS)
            .set(convert(token))
            .execute();
        return token;
    }

    @Override
    public Optional<RefreshToken> findById(UUID id) {
        return dsl.selectFrom(Tables.REFRESH_TOKENS)
            .where(Tables.REFRESH_TOKENS.ID.eq(id))
            .fetchOptional(this::convert);
    }

    @Override
    public Optional<RefreshToken> findByTokenHash(String tokenHash) {
        return dsl.selectFrom(Tables.REFRESH_TOKENS)
            .where(Tables.REFRESH_TOKENS.TOKEN_HASH.eq(tokenHash))
            .fetchOptional(this::convert);
    }

    @Override
    public int revoke(RefreshToken token) {
        return dsl.update(Tables.REFRESH_TOKENS)
            .set(Tables.REFRESH_TOKENS.REVOKED_AT, OffsetDateTime.now())
            .where(Tables.REFRESH_TOKENS.ID.eq(token.id()))
            .and(Tables.REFRESH_TOKENS.REVOKED_AT.isNull())
            .execute();
    }

    private RefreshTokensRecord convert(RefreshToken token) {
        RefreshTokensRecord record = new RefreshTokensRecord();
        record.setId(token.id());
        record.setUserId(token.userId());
        record.setTokenHash(token.tokenHash());
        record.setExpiresAt(token.expiresAt());
        record.setRevokedAt(token.revokedAt());
        record.setCreatedAt(token.createdAt());
        return record;
    }

    private RefreshToken convert(RefreshTokensRecord record) {
        return new RefreshToken(
            record.getId(),
            record.getUserId(),
            record.getTokenHash(),
            record.getExpiresAt(),
            record.getRevokedAt(),
            record.getCreatedAt()
        );
    }
}
