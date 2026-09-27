package com.meterhub.household.adapters.inbound.web;

import com.meterhub.household.adapters.inbound.web.api.InvitesApi;
import com.meterhub.household.adapters.inbound.web.dto.CreateInviteRequestDto;
import com.meterhub.household.adapters.inbound.web.dto.HouseholdRoleDto;
import com.meterhub.household.adapters.inbound.web.dto.InviteCreatedDto;
import com.meterhub.household.adapters.inbound.web.dto.InviteDto;
import com.meterhub.household.adapters.inbound.web.dto.RedeemInviteRequestDto;
import com.meterhub.household.adapters.inbound.web.dto.RedeemInviteResponseDto;
import com.meterhub.household.domain.model.HouseholdInvite.InviteRole;
import com.meterhub.household.ports.inbound.CreateHouseholdInviteUseCase;
import com.meterhub.household.ports.inbound.ListHouseholdInvitesUseCase;
import com.meterhub.household.ports.inbound.RedeemHouseholdInviteUseCase;
import com.meterhub.household.ports.inbound.RevokeHouseholdInviteUseCase;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class InvitesController implements InvitesApi {

    /** Mirrors the contract default for expiresInDays. */
    private static final int DEFAULT_TTL_DAYS = 7;

    private final CreateHouseholdInviteUseCase createHouseholdInviteUseCase;
    private final ListHouseholdInvitesUseCase listHouseholdInvitesUseCase;
    private final RevokeHouseholdInviteUseCase revokeHouseholdInviteUseCase;
    private final RedeemHouseholdInviteUseCase redeemHouseholdInviteUseCase;
    private final SpringSecurityAuthProvider springSecurityAuthProvider;

    public InvitesController(
        CreateHouseholdInviteUseCase createHouseholdInviteUseCase,
        ListHouseholdInvitesUseCase listHouseholdInvitesUseCase,
        RevokeHouseholdInviteUseCase revokeHouseholdInviteUseCase,
        RedeemHouseholdInviteUseCase redeemHouseholdInviteUseCase,
        SpringSecurityAuthProvider springSecurityAuthProvider
    ) {
        this.createHouseholdInviteUseCase = createHouseholdInviteUseCase;
        this.listHouseholdInvitesUseCase = listHouseholdInvitesUseCase;
        this.revokeHouseholdInviteUseCase = revokeHouseholdInviteUseCase;
        this.redeemHouseholdInviteUseCase = redeemHouseholdInviteUseCase;
        this.springSecurityAuthProvider = springSecurityAuthProvider;
    }

    @Override
    public ResponseEntity<InviteCreatedDto> createHouseholdInvite(UUID householdId,
                                                                  CreateInviteRequestDto createInviteRequest,
                                                                  UUID xCorrelationID) {
        var created = createHouseholdInviteUseCase.createInvite(
            springSecurityAuthProvider.currentUserId(),
            householdId,
            InviteRole.valueOf(createInviteRequest.getRole().name()),
            createInviteRequest.getExpiresInDays() != null
                ? createInviteRequest.getExpiresInDays()
                : DEFAULT_TTL_DAYS
        );
        var dto = new InviteCreatedDto(
            created.invite().id(),
            HouseholdRoleDto.valueOf(created.invite().role().name()),
            created.code(),
            created.invite().createdAt(),
            created.invite().expiresAt()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @Override
    public ResponseEntity<List<InviteDto>> listHouseholdInvites(UUID householdId, UUID xCorrelationID) {
        var invites = listHouseholdInvitesUseCase.listInvites(
            springSecurityAuthProvider.currentUserId(), householdId);
        List<InviteDto> dtos = invites.stream()
            .map(invite -> new InviteDto(
                invite.id(),
                HouseholdRoleDto.valueOf(invite.role().name()),
                invite.createdAt(),
                invite.expiresAt()
            ))
            .toList();
        return ResponseEntity.ok(dtos);
    }

    @Override
    public ResponseEntity<Void> revokeHouseholdInvite(UUID householdId, UUID inviteId, UUID xCorrelationID) {
        revokeHouseholdInviteUseCase.revokeInvite(
            springSecurityAuthProvider.currentUserId(), householdId, inviteId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<RedeemInviteResponseDto> redeemHouseholdInvite(RedeemInviteRequestDto redeemInviteRequest,
                                                                         UUID xCorrelationID) {
        var redeemed = redeemHouseholdInviteUseCase.redeem(
            springSecurityAuthProvider.currentUserId(),
            redeemInviteRequest.getCode()
        );
        var dto = new RedeemInviteResponseDto(
            redeemed.householdId(),
            redeemed.householdName(),
            HouseholdRoleDto.valueOf(redeemed.role().name())
        );
        return ResponseEntity.ok(dto);
    }
}
