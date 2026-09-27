package com.meterhub.household.ports.outbound;

import com.meterhub.household.domain.model.HouseholdMember;
import com.meterhub.household.domain.model.MembershipRole;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HouseholdMemberRepository {
    HouseholdMember save(HouseholdMember member);

    Optional<HouseholdMember> findByHouseholdIdAndUserId(UUID householdId, UUID userId);

    List<HouseholdMember> findAllByHouseholdId(UUID householdId);

    long countByHouseholdIdAndRole(UUID householdId, MembershipRole role);

    void delete(HouseholdMember member);
}
