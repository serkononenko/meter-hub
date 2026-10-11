package com.meterhub.household.ports.outbound;

import com.meterhub.household.domain.model.HouseholdMember;
import com.meterhub.household.domain.model.MembershipRole;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HouseholdMemberRepository {
    HouseholdMember save(HouseholdMember member);

    /** Live (not removed) memberships only, like every finder here. */
    Optional<HouseholdMember> findByHouseholdIdAndUserId(UUID householdId, UUID userId);

    List<HouseholdMember> findAllByHouseholdId(UUID householdId);

    long countByHouseholdIdAndRole(UUID householdId, MembershipRole role);

    /**
     * Soft-removes the membership (backlog D1): the row stays as an audit
     * tombstone, and every finder above treats it as absent.
     */
    void markRemoved(HouseholdMember member, UUID removedBy, OffsetDateTime removedAt);
}
