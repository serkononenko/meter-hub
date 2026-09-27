package com.meterhub.household.ports.inbound;

import java.util.UUID;

import com.meterhub.household.domain.model.MembershipRole;
import com.meterhub.household.ports.outbound.HouseholdRepository;

/**
 * Returns a single household the caller holds any membership in, with the
 * caller's role. Unknown household and non-member are indistinguishable —
 * both throw {@code HouseholdNotFoundException}.
 */
public interface GetHouseholdUseCase {
    HouseholdRepository.HouseholdWithRole get(UUID userId, UUID householdId);
}
