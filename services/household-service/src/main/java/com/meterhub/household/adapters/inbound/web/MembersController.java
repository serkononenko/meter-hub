package com.meterhub.household.adapters.inbound.web;

import com.meterhub.household.adapters.inbound.web.api.MembersApi;
import com.meterhub.household.adapters.inbound.web.dto.HouseholdRoleDto;
import com.meterhub.household.adapters.inbound.web.dto.MemberDto;
import com.meterhub.household.ports.inbound.ListHouseholdMembersUseCase;
import com.meterhub.household.ports.inbound.RemoveHouseholdMemberUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class MembersController implements MembersApi {

    private final ListHouseholdMembersUseCase listHouseholdMembersUseCase;
    private final RemoveHouseholdMemberUseCase removeHouseholdMemberUseCase;
    private final SpringSecurityAuthProvider springSecurityAuthProvider;

    public MembersController(
        ListHouseholdMembersUseCase listHouseholdMembersUseCase,
        RemoveHouseholdMemberUseCase removeHouseholdMemberUseCase,
        SpringSecurityAuthProvider springSecurityAuthProvider
    ) {
        this.listHouseholdMembersUseCase = listHouseholdMembersUseCase;
        this.removeHouseholdMemberUseCase = removeHouseholdMemberUseCase;
        this.springSecurityAuthProvider = springSecurityAuthProvider;
    }

    @Override
    public ResponseEntity<List<MemberDto>> listHouseholdMembers(UUID householdId, UUID xCorrelationID) {
        var members = listHouseholdMembersUseCase.listMembers(
            springSecurityAuthProvider.currentUserId(), householdId);
        List<MemberDto> dtos = members.stream()
            .map(member -> new MemberDto(
                member.id(),
                member.userId(),
                HouseholdRoleDto.valueOf(member.role().name()),
                member.createdAt()
            ))
            .toList();
        return ResponseEntity.ok(dtos);
    }

    @Override
    public ResponseEntity<Void> removeHouseholdMember(UUID householdId, UUID userId, UUID xCorrelationID) {
        removeHouseholdMemberUseCase.removeMember(
            springSecurityAuthProvider.currentUserId(), householdId, userId);
        return ResponseEntity.noContent().build();
    }
}
