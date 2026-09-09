package com.meterhub.household.adapters.outbound.persistence;

import com.meterhub.household.domain.model.HouseholdMember;
import com.meterhub.household.domain.model.MembershipRole;
import com.meterhub.household.jooq.Tables;
import com.meterhub.household.jooq.tables.records.HouseholdMembersRecord;
import com.meterhub.household.ports.outbound.HouseholdMemberRepository;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

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

    private HouseholdMembersRecord convert(HouseholdMember member) {
        HouseholdMembersRecord record = new HouseholdMembersRecord();
        record.setId(member.id());
        record.setHouseholdId(member.householdId());
        record.setUserId(member.userId());
        record.setRole(member.role().name());
        record.setCreatedAt(member.createdAt());
        return record;
    }

    private HouseholdMember convert(HouseholdMembersRecord record) {
        return HouseholdMember.builder()
            .id(record.getId())
            .householdId(record.getHouseholdId())
            .userId(record.getUserId())
            .role(MembershipRole.valueOf(record.getRole()))
            .createdAt(record.getCreatedAt())
            .build();
    }
}
