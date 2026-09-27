package com.meterhub.household.ports.outbound;

import com.meterhub.household.domain.model.Household;
import com.meterhub.household.domain.model.MembershipRole;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HouseholdRepository {
    Household save(Household household);

    Optional<Household> findById(UUID id);

    /**
     * All households the user holds any membership in, joined through
     * household_members, each paired with the membership role (any role,
     * not just owner).
     */
    List<HouseholdWithRole> findAllByMemberUserId(UUID userId);

    /**
     * Returns the household with the caller's role attached. Empty when the
     * household does not exist OR the user has no membership — callers treat
     * both identically to avoid revealing existence.
     */
    Optional<HouseholdWithRole> findByIdAndMemberUserId(UUID id, UUID userId);

    /** Household paired with the caller's membership role in it. */
    record HouseholdWithRole(Household household, MembershipRole role) {
    }
}
