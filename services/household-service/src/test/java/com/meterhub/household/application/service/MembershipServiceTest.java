package com.meterhub.household.application.service;

import com.meterhub.household.domain.exception.ForbiddenRoleException;
import com.meterhub.household.domain.exception.HouseholdAccessDeniedException;
import com.meterhub.household.domain.exception.InviteAlreadyUsedException;
import com.meterhub.household.domain.exception.InviteExpiredException;
import com.meterhub.household.domain.exception.InviteLimitReachedException;
import com.meterhub.household.domain.exception.InviteNotFoundException;
import com.meterhub.household.domain.exception.MemberNotFoundException;
import com.meterhub.household.domain.exception.OwnerCannotBeRemovedException;
import com.meterhub.household.domain.model.Household;
import com.meterhub.household.domain.model.HouseholdInvite;
import com.meterhub.household.domain.model.HouseholdMember;
import com.meterhub.household.domain.model.MembershipRole;
import com.meterhub.household.ports.outbound.HouseholdInviteRepository;
import com.meterhub.household.ports.outbound.HouseholdMemberRepository;
import com.meterhub.household.ports.outbound.HouseholdRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for member/invite management (A3): role-gated access,
 * invite lifecycle, and redemption semantics, without Spring or a database.
 */
@ExtendWith(MockitoExtension.class)
class MembershipServiceTest {

    private static final UUID OWNER_ID = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
    private static final UUID MEMBER_ID = UUID.fromString("6f2a4c8e-1b3d-4e5f-9a0b-7c8d9e0f1a2b");
    private static final UUID VIEWER_ID = UUID.fromString("7a3b5d9f-2c4e-4f6a-8b1c-8d9e0f1a2b3c");
    private static final UUID OUTSIDER_ID = UUID.fromString("0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01");
    private static final UUID HOUSEHOLD_ID = UUID.fromString("3f9c1a2e-8d4b-4a1f-9e2c-5b7d6a8e1c30");
    private static final UUID INVITE_ID = UUID.fromString("4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f7a");

    @Mock
    private HouseholdRepository householdRepository;
    @Mock
    private HouseholdMemberRepository householdMemberRepository;
    @Mock
    private HouseholdInviteRepository householdInviteRepository;

    private MembershipService membershipService;

    @BeforeEach
    void setUp() {
        membershipService = new MembershipService(
            householdRepository, householdMemberRepository, householdInviteRepository);
    }

    // --- role gating ---

    @Test
    void listMembersRequiresMembership() {
        when(householdMemberRepository.findByHouseholdIdAndUserId(HOUSEHOLD_ID, OUTSIDER_ID))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> membershipService.listMembers(OUTSIDER_ID, HOUSEHOLD_ID))
            .isInstanceOf(HouseholdAccessDeniedException.class);
    }

    @Test
    void removeMemberRejectsNonOwnerMember() {
        membership(MEMBER_ID, MembershipRole.MEMBER);

        assertThatThrownBy(() -> membershipService.removeMember(MEMBER_ID, HOUSEHOLD_ID, VIEWER_ID))
            .isInstanceOf(ForbiddenRoleException.class);
        verify(householdMemberRepository, never()).delete(any());
    }

    @Test
    void removeMemberRejectsTheOwnerAsTarget() {
        membership(OWNER_ID, MembershipRole.OWNER);

        assertThatThrownBy(() -> membershipService.removeMember(OWNER_ID, HOUSEHOLD_ID, OWNER_ID))
            .isInstanceOf(OwnerCannotBeRemovedException.class);
        verify(householdMemberRepository, never()).delete(any());
    }

    @Test
    void removeMemberDeletesTheTargetMembership() {
        membership(OWNER_ID, MembershipRole.OWNER);
        HouseholdMember target = member(VIEWER_ID, MembershipRole.VIEWER);
        when(householdMemberRepository.findByHouseholdIdAndUserId(HOUSEHOLD_ID, VIEWER_ID))
            .thenReturn(Optional.of(target));

        membershipService.removeMember(OWNER_ID, HOUSEHOLD_ID, VIEWER_ID);

        verify(householdMemberRepository).delete(target);
    }

    @Test
    void removeMemberThrowsWhenTargetHasNoMembership() {
        membership(OWNER_ID, MembershipRole.OWNER);
        when(householdMemberRepository.findByHouseholdIdAndUserId(HOUSEHOLD_ID, OUTSIDER_ID))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> membershipService.removeMember(OWNER_ID, HOUSEHOLD_ID, OUTSIDER_ID))
            .isInstanceOf(MemberNotFoundException.class);
    }

    // --- invites ---

    @Test
    void createInviteRejectsNonOwner() {
        membership(MEMBER_ID, MembershipRole.MEMBER);

        assertThatThrownBy(() ->
            membershipService.createInvite(MEMBER_ID, HOUSEHOLD_ID, HouseholdInvite.InviteRole.MEMBER, 7))
            .isInstanceOf(ForbiddenRoleException.class);
        verify(householdInviteRepository, never()).save(any());
    }

    @Test
    void createInviteReturnsThePlaintextCodeExactlyOnceAndStoresOnlyHash() {
        membership(OWNER_ID, MembershipRole.OWNER);
        when(householdInviteRepository.countLiveByHouseholdId(HOUSEHOLD_ID)).thenReturn(0L);
        when(householdInviteRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var created = membershipService.createInvite(
            OWNER_ID, HOUSEHOLD_ID, HouseholdInvite.InviteRole.VIEWER, 7);

        assertThat(created.code()).startsWith("mh_");
        assertThat(created.code()).doesNotContain(created.invite().codeHash());
        ArgumentCaptor<HouseholdInvite> captor = ArgumentCaptor.forClass(HouseholdInvite.class);
        verify(householdInviteRepository).save(captor.capture());
        assertThat(captor.getValue().role()).isEqualTo(HouseholdInvite.InviteRole.VIEWER);
        assertThat(captor.getValue().expiresAt()).isAfter(OffsetDateTime.now().plusDays(6));
    }

    @Test
    void createInviteEnforcesTheLiveInviteBound() {
        membership(OWNER_ID, MembershipRole.OWNER);
        when(householdInviteRepository.countLiveByHouseholdId(HOUSEHOLD_ID))
            .thenReturn((long) MembershipService.MAX_LIVE_INVITES);

        assertThatThrownBy(() ->
            membershipService.createInvite(OWNER_ID, HOUSEHOLD_ID, HouseholdInvite.InviteRole.MEMBER, 7))
            .isInstanceOf(InviteLimitReachedException.class);
        verify(householdInviteRepository, never()).save(any());
    }

    @Test
    void revokeMarksTheInviteRevoked() {
        membership(OWNER_ID, MembershipRole.OWNER);
        HouseholdInvite invite = liveInvite(HouseholdInvite.InviteRole.MEMBER);
        when(householdInviteRepository.findById(INVITE_ID)).thenReturn(Optional.of(invite));
        when(householdInviteRepository.update(any())).thenAnswer(inv -> inv.getArgument(0));

        membershipService.revokeInvite(OWNER_ID, HOUSEHOLD_ID, INVITE_ID);

        verify(householdInviteRepository).update(org.mockito.ArgumentMatchers.argThat(
            updated -> updated.revokedAt() != null));
    }

    @Test
    void revokeRejectsUnknownOrNonLiveInvites() {
        membership(OWNER_ID, MembershipRole.OWNER);
        when(householdInviteRepository.findById(INVITE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> membershipService.revokeInvite(OWNER_ID, HOUSEHOLD_ID, INVITE_ID))
            .isInstanceOf(InviteNotFoundException.class);
    }

    // --- redeem ---

    @Test
    void redeemCreatesMembershipWithTheInviteRole() {
        String code = "mh_abcdef";
        HouseholdInvite invite = liveInvite(HouseholdInvite.InviteRole.MEMBER);
        when(householdInviteRepository.findByCodeHash(org.mockito.ArgumentMatchers.anyString()))
            .thenReturn(Optional.of(invite));
        when(householdMemberRepository.findByHouseholdIdAndUserId(HOUSEHOLD_ID, OUTSIDER_ID))
            .thenReturn(Optional.empty());
        when(householdRepository.findById(HOUSEHOLD_ID))
            .thenReturn(Optional.of(household("Home")));
        when(householdInviteRepository.update(any())).thenAnswer(inv -> inv.getArgument(0));

        var redeemed = membershipService.redeem(OUTSIDER_ID, code);

        assertThat(redeemed.role()).isEqualTo(MembershipRole.MEMBER);
        assertThat(redeemed.householdId()).isEqualTo(HOUSEHOLD_ID);
        ArgumentCaptor<HouseholdMember> captor = ArgumentCaptor.forClass(HouseholdMember.class);
        verify(householdMemberRepository).save(captor.capture());
        assertThat(captor.getValue().userId()).isEqualTo(OUTSIDER_ID);
        assertThat(captor.getValue().role()).isEqualTo(MembershipRole.MEMBER);
        verify(householdInviteRepository).update(org.mockito.ArgumentMatchers.argThat(
            updated -> OUTSIDER_ID.equals(updated.redeemedBy()) && updated.redeemedAt() != null));
    }

    @Test
    void redeemIsIdempotentForTheInviteeWhoAlreadyUsedIt() {
        HouseholdInvite invite = liveInvite(HouseholdInvite.InviteRole.MEMBER)
            .toBuilder().redeemedAt(OffsetDateTime.now()).redeemedBy(OUTSIDER_ID).build();
        when(householdInviteRepository.findByCodeHash(org.mockito.ArgumentMatchers.anyString()))
            .thenReturn(Optional.of(invite));
        when(householdRepository.findById(HOUSEHOLD_ID))
            .thenReturn(Optional.of(household("Home")));

        var redeemed = membershipService.redeem(OUTSIDER_ID, "mh_abcdef");

        assertThat(redeemed.role()).isEqualTo(MembershipRole.MEMBER);
        verify(householdMemberRepository, never()).save(any());
    }

    @Test
    void redeemRejectsACodeUsedBySomeoneElse() {
        HouseholdInvite invite = liveInvite(HouseholdInvite.InviteRole.MEMBER)
            .toBuilder().redeemedAt(OffsetDateTime.now()).redeemedBy(MEMBER_ID).build();
        when(householdInviteRepository.findByCodeHash(org.mockito.ArgumentMatchers.anyString()))
            .thenReturn(Optional.of(invite));

        assertThatThrownBy(() -> membershipService.redeem(OUTSIDER_ID, "mh_abcdef"))
            .isInstanceOf(InviteAlreadyUsedException.class);
    }

    @Test
    void redeemRejectsAnExpiredCode() {
        HouseholdInvite invite = liveInvite(HouseholdInvite.InviteRole.MEMBER)
            .toBuilder().expiresAt(OffsetDateTime.now().minusDays(1)).build();
        when(householdInviteRepository.findByCodeHash(org.mockito.ArgumentMatchers.anyString()))
            .thenReturn(Optional.of(invite));

        assertThatThrownBy(() -> membershipService.redeem(OUTSIDER_ID, "mh_abcdef"))
            .isInstanceOf(InviteExpiredException.class);
    }

    @Test
    void redeemRejectsAnUnknownCode() {
        when(householdInviteRepository.findByCodeHash(org.mockito.ArgumentMatchers.anyString()))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> membershipService.redeem(OUTSIDER_ID, "mh_nope"))
            .isInstanceOf(InviteNotFoundException.class);
    }

    @Test
    void redeemKeepsTheHigherExistingRoleWhenAlreadyAMember() {
        String code = "mh_abcdef";
        HouseholdInvite invite = liveInvite(HouseholdInvite.InviteRole.VIEWER);
        when(householdInviteRepository.findByCodeHash(org.mockito.ArgumentMatchers.anyString()))
            .thenReturn(Optional.of(invite));
        when(householdMemberRepository.findByHouseholdIdAndUserId(HOUSEHOLD_ID, MEMBER_ID))
            .thenReturn(Optional.of(member(MEMBER_ID, MembershipRole.MEMBER)));
        when(householdRepository.findById(HOUSEHOLD_ID))
            .thenReturn(Optional.of(household("Home")));
        when(householdInviteRepository.update(any())).thenAnswer(inv -> inv.getArgument(0));

        var redeemed = membershipService.redeem(MEMBER_ID, code);

        // Already a MEMBER (stronger than the invite's VIEWER): no downgrade.
        assertThat(redeemed.role()).isEqualTo(MembershipRole.MEMBER);
        verify(householdMemberRepository, never()).save(any());
    }

    // --- helpers ---

    private void membership(UUID userId, MembershipRole role) {
        when(householdMemberRepository.findByHouseholdIdAndUserId(HOUSEHOLD_ID, userId))
            .thenReturn(Optional.of(member(userId, role)));
    }

    private HouseholdMember member(UUID userId, MembershipRole role) {
        return HouseholdMember.builder()
            .id(UUID.randomUUID())
            .householdId(HOUSEHOLD_ID)
            .userId(userId)
            .role(role)
            .createdAt(OffsetDateTime.now())
            .build();
    }

    private HouseholdInvite liveInvite(HouseholdInvite.InviteRole role) {
        return HouseholdInvite.builder()
            .id(INVITE_ID)
            .householdId(HOUSEHOLD_ID)
            .role(role)
            .codeHash("hash")
            .createdBy(OWNER_ID)
            .expiresAt(OffsetDateTime.now().plusDays(7))
            .createdAt(OffsetDateTime.now())
            .build();
    }

    private Household household(String name) {
        OffsetDateTime now = OffsetDateTime.now();
        return Household.builder()
            .id(HOUSEHOLD_ID)
            .ownerUserId(OWNER_ID)
            .name(name)
            .createdAt(now)
            .updatedAt(now)
            .build();
    }
}
