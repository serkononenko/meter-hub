package com.meterhub.household.ports.inbound;

import java.util.UUID;

/** Owner-only revocation of a live invitation. */
public interface RevokeHouseholdInviteUseCase {
    void revokeInvite(UUID requesterId, UUID householdId, UUID inviteId);
}
