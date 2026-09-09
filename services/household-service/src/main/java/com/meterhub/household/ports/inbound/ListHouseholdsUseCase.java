package com.meterhub.household.ports.inbound;

import java.util.List;
import java.util.UUID;

import com.meterhub.household.domain.model.Household;

/**
 * Returns the households of a single owner, most recently created first.
 */
public interface ListHouseholdsUseCase {
    List<Household> list(UUID ownerUserId);
}
