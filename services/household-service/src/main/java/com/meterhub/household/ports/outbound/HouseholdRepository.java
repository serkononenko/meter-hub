package com.meterhub.household.ports.outbound;

import com.meterhub.household.domain.model.Household;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HouseholdRepository {
    Household save(Household household);

    Optional<Household> findById(UUID id);

    Optional<Household> findByIdAndOwnerUserId(UUID id, UUID ownerUserId);

    List<Household> findAllByOwnerUserId(UUID ownerUserId);
}
