package com.meterhub.household.ports.inbound;

import java.util.List;
import java.util.UUID;

import com.meterhub.household.domain.model.MembershipRole;
import com.meterhub.household.ports.outbound.HouseholdRepository;

/**
 * Returns the households the user holds any membership in, each with the
 * caller's role, most recently created first. Replaces the MVP
 * "everything I own" semantics.
 */
public interface ListHouseholdsUseCase {
    List<HouseholdRepository.HouseholdWithRole> list(UUID userId);
}
