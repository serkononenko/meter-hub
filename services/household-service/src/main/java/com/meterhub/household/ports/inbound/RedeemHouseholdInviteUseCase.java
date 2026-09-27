package com.meterhub.household.ports.inbound;

import java.util.UUID;

/**
 * Redeems an invitation code for the authenticated user. Idempotent for an
 * existing member: re-redeeming succeeds as a no-op.
 */
public interface RedeemHouseholdInviteUseCase {
    RedeemedInvite redeem(UUID redeemerId, String code);

    /** The household joined (or already belonged to), with the effective role. */
    record RedeemedInvite(UUID householdId, String householdName,
                          com.meterhub.household.domain.model.MembershipRole role) {
    }
}
