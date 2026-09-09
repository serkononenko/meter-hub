package com.meterhub.household.adapters.outbound.persistence;

import com.meterhub.household.domain.model.Household;
import com.meterhub.household.jooq.Tables;
import com.meterhub.household.jooq.tables.records.HouseholdsRecord;
import com.meterhub.household.ports.outbound.HouseholdRepository;
import org.jooq.DSLContext;
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
            .fetchOptional(this::convert);
    }

    @Override
    public Optional<Household> findByIdAndOwnerUserId(UUID id, UUID ownerUserId) {
        return dsl.selectFrom(Tables.HOUSEHOLDS)
            .where(Tables.HOUSEHOLDS.ID.eq(id))
            .and(Tables.HOUSEHOLDS.OWNER_USER_ID.eq(ownerUserId))
            .fetchOptional(this::convert);
    }

    @Override
    public List<Household> findAllByOwnerUserId(UUID ownerUserId) {
        return dsl.selectFrom(Tables.HOUSEHOLDS)
            .where(Tables.HOUSEHOLDS.OWNER_USER_ID.eq(ownerUserId))
            .orderBy(Tables.HOUSEHOLDS.CREATED_AT.desc())
        .fetch(this::convert);
    }

    private HouseholdsRecord convert(Household household) {
        HouseholdsRecord record = new HouseholdsRecord();
        record.setId(household.id());
        record.setOwnerUserId(household.ownerUserId());
        record.setName(household.name());
        record.setCreatedAt(household.createdAt());
        record.setUpdatedAt(household.updatedAt());
        return record;
    }

    private Household convert(HouseholdsRecord record) {
        return Household.builder()
            .id(record.getId())
            .ownerUserId(record.getOwnerUserId())
            .name(record.getName())
            .createdAt(record.getCreatedAt())
            .updatedAt(record.getUpdatedAt())
            .build();
    }
}
