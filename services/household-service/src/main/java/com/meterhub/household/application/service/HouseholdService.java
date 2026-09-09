package com.meterhub.household.application.service;

import com.meterhub.household.application.command.CreateHouseholdCommand;
import com.meterhub.household.domain.model.Household;
import com.meterhub.household.domain.model.HouseholdMember;
import com.meterhub.household.domain.model.MembershipRole;
import com.meterhub.household.ports.inbound.CreateHouseholdUseCase;
import com.meterhub.household.ports.outbound.HouseholdMemberRepository;
import com.meterhub.household.ports.outbound.HouseholdRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class HouseholdService implements CreateHouseholdUseCase {
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
        Household household = Household.builder()
            .id(command.householdId())
            .ownerUserId(command.ownerUserId())
            .name(command.name())
            .createdAt(OffsetDateTime.now())
            .build();
        householdRepository.save(household);

        HouseholdMember owner = HouseholdMember.builder()
            .id(UUID.randomUUID())
            .householdId(household.id())
            .userId(command.ownerUserId())
            .role(MembershipRole.OWNER)
            .createdAt(OffsetDateTime.now())
            .build();
        householdMemberRepository.save(owner);

        return household;
    }
}
