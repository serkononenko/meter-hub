package com.meterhub.household.application.service;

import com.meterhub.household.application.command.CreateHouseholdCommand;
import com.meterhub.household.domain.exception.HouseholdNotFoundException;
import com.meterhub.household.domain.model.Household;
import com.meterhub.household.domain.model.HouseholdMember;
import com.meterhub.household.domain.model.MembershipRole;
import com.meterhub.household.ports.inbound.CreateHouseholdUseCase;
import com.meterhub.household.ports.inbound.GetHouseholdUseCase;
import com.meterhub.household.ports.inbound.ListHouseholdsUseCase;
import com.meterhub.household.ports.outbound.HouseholdMemberRepository;
import com.meterhub.household.ports.outbound.HouseholdRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Every authorization decision here resolves through the requester's
 * membership role — no user is trusted merely for being authenticated.
 * Unknown household and non-member are deliberately indistinguishable:
 * both surface as {@link HouseholdNotFoundException} so existence is never
 * revealed to non-members.
 */
@Service
public class HouseholdService implements CreateHouseholdUseCase, ListHouseholdsUseCase, GetHouseholdUseCase {
    private final HouseholdRepository householdRepository;
    private final HouseholdMemberRepository householdMemberRepository;

    public HouseholdService(
        HouseholdRepository householdRepository,
        HouseholdMemberRepository householdMemberRepository
    ) {
        this.householdRepository = householdRepository;
        this.householdMemberRepository = householdMemberRepository;
    }

    @Override
    @Transactional
    public Household create(CreateHouseholdCommand command) {
        OffsetDateTime now = OffsetDateTime.now();
        Household household = Household.builder()
            .id(command.householdId())
            .ownerUserId(command.ownerUserId())
            .name(command.name())
            .createdAt(now)
            .updatedAt(now)
            .build();
        householdRepository.save(household);

        HouseholdMember owner = HouseholdMember.builder()
            .id(UUID.randomUUID())
            .householdId(household.id())
            .userId(command.ownerUserId())
            .role(MembershipRole.OWNER)
            .createdAt(now)
            .build();
        householdMemberRepository.save(owner);

        return household;
    }

    @Override
    @Transactional(readOnly = true)
    public List<HouseholdRepository.HouseholdWithRole> list(UUID userId) {
        return householdRepository.findAllByMemberUserId(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public HouseholdRepository.HouseholdWithRole get(UUID userId, UUID householdId) {
        return householdRepository.findByIdAndMemberUserId(householdId, userId)
            .orElseThrow(HouseholdNotFoundException::new);
    }
}
