package com.meterhub.household.ports.outbound;

import com.meterhub.household.domain.model.HouseholdInvite;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HouseholdInviteRepository {
    HouseholdInvite save(HouseholdInvite invite);

    Optional<HouseholdInvite> findById(UUID id);

    Optional<HouseholdInvite> findByCodeHash(String codeHash);

    List<HouseholdInvite> findAllLiveByHouseholdId(UUID householdId, OffsetDateTime now);

    /** Number of live (unredeemed, unrevoked) invites for the household. */
    long countLiveByHouseholdId(UUID householdId);

    HouseholdInvite update(HouseholdInvite invite);
}
