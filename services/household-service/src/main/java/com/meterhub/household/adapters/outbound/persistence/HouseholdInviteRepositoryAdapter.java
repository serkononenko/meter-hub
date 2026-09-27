package com.meterhub.household.adapters.outbound.persistence;

import com.meterhub.household.domain.model.HouseholdInvite;
import com.meterhub.household.domain.model.HouseholdInvite.InviteRole;
import com.meterhub.household.jooq.Tables;
import com.meterhub.household.jooq.tables.records.HouseholdInvitesRecord;
import com.meterhub.household.ports.outbound.HouseholdInviteRepository;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class HouseholdInviteRepositoryAdapter implements HouseholdInviteRepository {
    private final DSLContext dsl;

    public HouseholdInviteRepositoryAdapter(DSLContext dsl) {
        this.dsl = dsl;
    }

    @Override
    public HouseholdInvite save(HouseholdInvite invite) {
        dsl.insertInto(Tables.HOUSEHOLD_INVITES)
            .set(convert(invite))
            .execute();
        return invite;
    }

    @Override
    public Optional<HouseholdInvite> findById(UUID id) {
        return dsl.selectFrom(Tables.HOUSEHOLD_INVITES)
            .where(Tables.HOUSEHOLD_INVITES.ID.eq(id))
            .fetchOptional(this::convert);
    }

    @Override
    public Optional<HouseholdInvite> findByCodeHash(String codeHash) {
        return dsl.selectFrom(Tables.HOUSEHOLD_INVITES)
            .where(Tables.HOUSEHOLD_INVITES.CODE_HASH.eq(codeHash))
            .fetchOptional(this::convert);
    }

    @Override
    public List<HouseholdInvite> findAllLiveByHouseholdId(UUID householdId, OffsetDateTime now) {
        return dsl.selectFrom(Tables.HOUSEHOLD_INVITES)
            .where(Tables.HOUSEHOLD_INVITES.HOUSEHOLD_ID.eq(householdId))
            .and(Tables.HOUSEHOLD_INVITES.REDEEMED_AT.isNull())
            .and(Tables.HOUSEHOLD_INVITES.REVOKED_AT.isNull())
            .and(Tables.HOUSEHOLD_INVITES.EXPIRES_AT.gt(now))
            .orderBy(Tables.HOUSEHOLD_INVITES.CREATED_AT.desc())
            .fetch(this::convert);
    }

    @Override
    public long countLiveByHouseholdId(UUID householdId) {
        return dsl.fetchCount(
            Tables.HOUSEHOLD_INVITES,
            Tables.HOUSEHOLD_INVITES.HOUSEHOLD_ID.eq(householdId)
                .and(Tables.HOUSEHOLD_INVITES.REDEEMED_AT.isNull())
                .and(Tables.HOUSEHOLD_INVITES.REVOKED_AT.isNull()));
    }

    @Override
    public HouseholdInvite update(HouseholdInvite invite) {
        dsl.update(Tables.HOUSEHOLD_INVITES)
            .set(convert(invite))
            .where(Tables.HOUSEHOLD_INVITES.ID.eq(invite.id()))
            .execute();
        return invite;
    }

    private HouseholdInvitesRecord convert(HouseholdInvite invite) {
        HouseholdInvitesRecord record = new HouseholdInvitesRecord();
        record.setId(invite.id());
        record.setHouseholdId(invite.householdId());
        record.setRole(invite.role().name());
        record.setCodeHash(invite.codeHash());
        record.setCreatedBy(invite.createdBy());
        record.setExpiresAt(invite.expiresAt());
        record.setRedeemedAt(invite.redeemedAt());
        record.setRedeemedBy(invite.redeemedBy());
        record.setRevokedAt(invite.revokedAt());
        record.setCreatedAt(invite.createdAt());
        return record;
    }

    private HouseholdInvite convert(HouseholdInvitesRecord record) {
        return HouseholdInvite.builder()
            .id(record.getId())
            .householdId(record.getHouseholdId())
            .role(InviteRole.valueOf(record.getRole()))
            .codeHash(record.getCodeHash())
            .createdBy(record.getCreatedBy())
            .expiresAt(record.getExpiresAt())
            .redeemedAt(record.getRedeemedAt())
            .redeemedBy(record.getRedeemedBy())
            .revokedAt(record.getRevokedAt())
            .createdAt(record.getCreatedAt())
            .build();
    }
}
