package com.meterhub.household.ports.inbound;

import com.meterhub.household.domain.model.HouseholdMember;

import java.util.List;
import java.util.UUID;

/** Lists members of a household. Requires any membership in it. */
public interface ListHouseholdMembersUseCase {
    List<HouseholdMember> listMembers(UUID requesterId, UUID householdId);
}
