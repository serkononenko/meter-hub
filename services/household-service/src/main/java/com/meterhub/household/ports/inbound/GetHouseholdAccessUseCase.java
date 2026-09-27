package com.meterhub.household.ports.inbound;

import com.meterhub.household.domain.model.MembershipRole;

import java.util.Optional;
import java.util.UUID;

/**
 * Narrow service-to-service accessor: resolves a user/household pair to a
 * role verdict. Consumers (meter, reading services) cache the result
 * briefly; membership details stay inside the household service.
 */
public interface GetHouseholdAccessUseCase {
    Optional<MembershipRole> getAccess(UUID householdId, UUID userId);
}
