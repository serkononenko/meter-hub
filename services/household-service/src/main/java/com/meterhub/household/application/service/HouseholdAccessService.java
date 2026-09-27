package com.meterhub.household.application.service;

import com.meterhub.household.domain.model.MembershipRole;
import com.meterhub.household.ports.inbound.GetHouseholdAccessUseCase;
import com.meterhub.household.ports.outbound.HouseholdMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/**
 * Narrow accessor backing GET /api/v1/internal/household-access. Resolves
 * the membership role for a user/household pair; empty when the user has no
 * membership there. No other membership detail crosses this boundary.
 */
@Service
public class HouseholdAccessService implements GetHouseholdAccessUseCase {

    private final HouseholdMemberRepository householdMemberRepository;

    public HouseholdAccessService(HouseholdMemberRepository householdMemberRepository) {
        this.householdMemberRepository = householdMemberRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MembershipRole> getAccess(UUID householdId, UUID userId) {
        return householdMemberRepository.findByHouseholdIdAndUserId(householdId, userId)
            .map(member -> member.role());
    }
}
