package com.meterhub.household.adapters.outbound.persistence;

import com.meterhub.household.domain.model.HouseholdMember;
import com.meterhub.household.domain.model.MembershipRole;
import com.meterhub.household.jooq.Tables;
import com.meterhub.household.jooq.tables.records.HouseholdMembersRecord;
import com.meterhub.household.ports.outbound.HouseholdMemberRepository;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class HouseholdMemberRepositoryAdapter implements HouseholdMemberRepository {
    private final DSLContext dsl;

    public HouseholdMemberRepositoryAdapter(DSLContext dsl) {
        this.dsl = dsl;
    }

    @Override
    public HouseholdMember save(HouseholdMember member) {
        dsl.insertInto(Tables.HOUSEHOLD_MEMBERS)
            .set(convert(member))
            .execute();
        return member;
    }

    @Override
    public Optional<HouseholdMember> findByHouseholdIdAndUserId(UUID householdId, UUID userId) {
        return dsl.selectFrom(Tables.HOUSEHOLD_MEMBERS)
            .where(Tables.HOUSEHOLD_MEMBERS.HOUSEHOLD_ID.eq(householdId))
            .and(Tables.HOUSEHOLD_MEMBERS.USER_ID.eq(userId))
            .and(Tables.HOUSEHOLD_MEMBERS.REMOVED_AT.isNull())
            .fetchOptional(this::convert);
    }

    @Override
    public List<HouseholdMember> findAllByHouseholdId(UUID householdId) {
        return dsl.selectFrom(Tables.HOUSEHOLD_MEMBERS)
            .where(Tables.HOUSEHOLD_MEMBERS.HOUSEHOLD_ID.eq(householdId))
            .and(Tables.HOUSEHOLD_MEMBERS.REMOVED_AT.isNull())
            .orderBy(Tables.HOUSEHOLD_MEMBERS.CREATED_AT.asc())
            .fetch(this::convert);
    }

    @Override
    public long countByHouseholdIdAndRole(UUID householdId, MembershipRole role) {
        return dsl.fetchCount(
            Tables.HOUSEHOLD_MEMBERS,
            Tables.HOUSEHOLD_MEMBERS.HOUSEHOLD_ID.eq(householdId)
                .and(Tables.HOUSEHOLD_MEMBERS.ROLE.eq(role.name()))
                .and(Tables.HOUSEHOLD_MEMBERS.REMOVED_AT.isNull()));
    }

    @Override
    public void markRemoved(HouseholdMember member, UUID removedBy, OffsetDateTime removedAt) {
        dsl.update(Tables.HOUSEHOLD_MEMBERS)
            .set(Tables.HOUSEHOLD_MEMBERS.REMOVED_AT, removedAt)
            .set(Tables.HOUSEHOLD_MEMBERS.REMOVED_BY, removedBy)
            .where(Tables.HOUSEHOLD_MEMBERS.ID.eq(member.id()))
            .and(Tables.HOUSEHOLD_MEMBERS.REMOVED_AT.isNull())
            .execute();
    }

    private HouseholdMembersRecord convert(HouseholdMember member) {
        HouseholdMembersRecord record = new HouseholdMembersRecord();
        record.setId(member.id());
        record.setHouseholdId(member.householdId());
        record.setUserId(member.userId());
        record.setRole(member.role().name());
        record.setCreatedAt(member.createdAt());
        record.setCreatedBy(member.createdBy());
        record.setRemovedAt(member.removedAt());
        record.setRemovedBy(member.removedBy());
        return record;
    }

    private HouseholdMember convert(HouseholdMembersRecord record) {
        return HouseholdMember.builder()
            .id(record.getId())
            .householdId(record.getHouseholdId())
            .userId(record.getUserId())
            .role(MembershipRole.valueOf(record.getRole()))
            .createdAt(record.getCreatedAt())
            .createdBy(record.getCreatedBy())
            .removedAt(record.getRemovedAt())
            .removedBy(record.getRemovedBy())
            .build();
    }
}
