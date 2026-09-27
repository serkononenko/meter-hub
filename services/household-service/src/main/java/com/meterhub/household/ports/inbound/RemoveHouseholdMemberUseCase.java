package com.meterhub.household.ports.inbound;

import java.util.UUID;

/** Owner-only removal of a member's membership. */
public interface RemoveHouseholdMemberUseCase {
    void removeMember(UUID requesterId, UUID householdId, UUID targetUserId);
}
