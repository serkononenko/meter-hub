package com.meterhub.household.ports.inbound;

import java.util.UUID;

import com.meterhub.household.domain.model.Household;

/**
 * Returns a single household, scoped to its owner.
 */
public interface GetHouseholdUseCase {
    Household get(UUID ownerUserId, UUID householdId);
}
