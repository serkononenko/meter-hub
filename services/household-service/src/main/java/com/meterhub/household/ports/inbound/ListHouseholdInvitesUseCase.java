package com.meterhub.household.ports.inbound;

import com.meterhub.household.domain.model.HouseholdInvite;

import java.util.List;
import java.util.UUID;

/** Owner-only listing of live invitations. */
public interface ListHouseholdInvitesUseCase {
    List<HouseholdInvite> listInvites(UUID requesterId, UUID householdId);
}
