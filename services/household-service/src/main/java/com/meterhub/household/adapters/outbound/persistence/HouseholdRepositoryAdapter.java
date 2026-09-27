package com.meterhub.household.adapters.outbound.persistence;

import com.meterhub.household.domain.model.Household;
import com.meterhub.household.domain.model.MembershipRole;
import com.meterhub.household.jooq.Tables;
import com.meterhub.household.jooq.tables.records.HouseholdsRecord;
import com.meterhub.household.ports.outbound.HouseholdRepository;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class HouseholdRepositoryAdapter implements HouseholdRepository {
    private final DSLContext dsl;

    public HouseholdRepositoryAdapter(DSLContext dsl) {
        this.dsl = dsl;
    }

    @Override
    public Household save(Household household) {
        dsl.insertInto(Tables.HOUSEHOLDS)
            .set(convert(household))
            .execute();
        return household;
    }

    @Override
    public Optional<Household> findById(UUID id) {
        return dsl.selectFrom(Tables.HOUSEHOLDS)
            .where(Tables.HOUSEHOLDS.ID.eq(id))
            .fetchOptional(HouseholdRepositoryAdapter::convert);
    }

    @Override
    public List<HouseholdWithRole> findAllByMemberUserId(UUID userId) {
        return dsl.select()
            .from(Tables.HOUSEHOLDS)
            .join(Tables.HOUSEHOLD_MEMBERS)
            .on(Tables.HOUSEHOLD_MEMBERS.HOUSEHOLD_ID.eq(Tables.HOUSEHOLDS.ID))
            .where(Tables.HOUSEHOLD_MEMBERS.USER_ID.eq(userId))
            .orderBy(Tables.HOUSEHOLDS.CREATED_AT.desc())
            .fetch(HouseholdRepositoryAdapter::convertWithRole);
    }

    @Override
    public Optional<HouseholdWithRole> findByIdAndMemberUserId(UUID id, UUID userId) {
        return dsl.select()
            .from(Tables.HOUSEHOLDS)
            .join(Tables.HOUSEHOLD_MEMBERS)
            .on(Tables.HOUSEHOLD_MEMBERS.HOUSEHOLD_ID.eq(Tables.HOUSEHOLDS.ID))
            .where(Tables.HOUSEHOLDS.ID.eq(id))
            .and(Tables.HOUSEHOLD_MEMBERS.USER_ID.eq(userId))
            .fetchOptional(HouseholdRepositoryAdapter::convertWithRole);
    }

    private static HouseholdWithRole convertWithRole(Record record) {
        Household household = convert(record.into(Tables.HOUSEHOLDS));
        MembershipRole role = MembershipRole.valueOf(
            record.get(Tables.HOUSEHOLD_MEMBERS.ROLE));
        return new HouseholdWithRole(household, role);
    }

    private static HouseholdsRecord convert(Household household) {
        HouseholdsRecord record = new HouseholdsRecord();
        record.setId(household.id());
        record.setOwnerUserId(household.ownerUserId());
        record.setName(household.name());
        record.setCreatedAt(household.createdAt());
        record.setUpdatedAt(household.updatedAt());
        return record;
    }

    private static Household convert(HouseholdsRecord record) {
        return Household.builder()
            .id(record.getId())
            .ownerUserId(record.getOwnerUserId())
            .name(record.getName())
            .createdAt(record.getCreatedAt())
            .updatedAt(record.getUpdatedAt())
            .build();
    }
}
