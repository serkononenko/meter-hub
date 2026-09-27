package com.meterhub.household.ports.inbound;

import com.meterhub.household.domain.model.HouseholdInvite;
import com.meterhub.household.domain.model.HouseholdInvite.InviteRole;

import java.util.UUID;

/**
 * Owner-only creation of a single-use invitation. The plaintext code is
 * returned exactly once, inside the result.
 */
public interface CreateHouseholdInviteUseCase {
    CreatedInvite createInvite(UUID requesterId, UUID householdId, InviteRole role, int expiresInDays);

    /** Created invitation plus the one-time plaintext code. */
    record CreatedInvite(HouseholdInvite invite, String code) {
    }
}
