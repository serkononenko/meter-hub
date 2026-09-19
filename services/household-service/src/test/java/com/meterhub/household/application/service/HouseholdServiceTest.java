package com.meterhub.household.application.service;

import com.meterhub.household.application.command.CreateHouseholdCommand;
import com.meterhub.household.domain.exception.HouseholdNotFoundException;
import com.meterhub.household.domain.model.Household;
import com.meterhub.household.domain.model.HouseholdMember;
import com.meterhub.household.domain.model.MembershipRole;
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
 * Unit tests for the household application service (task 9.2). Covers
 * creation, listing, and owner-scoped lookup without Spring or a database.
 */
@ExtendWith(MockitoExtension.class)
class HouseholdServiceTest {

    private static final UUID OWNER_ID = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
    private static final UUID HOUSEHOLD_ID = UUID.fromString("3f9c1a2e-8d4b-4a1f-9e2c-5b7d6a8e1c30");
    private static final UUID OTHER_USER_ID = UUID.fromString("0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01");

    @Mock
    private HouseholdRepository householdRepository;

    @Mock
    private HouseholdMemberRepository householdMemberRepository;

    private HouseholdService householdService;

    @BeforeEach
    void setUp() {
        householdService = new HouseholdService(householdRepository, householdMemberRepository);
    }

    @Test
    void createSavesTheHouseholdAndRegistersTheOwnerAsOwnerMember() {
        when(householdRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(householdMemberRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        Household created = householdService.create(new CreateHouseholdCommand(HOUSEHOLD_ID, OWNER_ID, "Home"));

        assertThat(created.id()).isEqualTo(HOUSEHOLD_ID);
        assertThat(created.ownerUserId()).isEqualTo(OWNER_ID);
        assertThat(created.name()).isEqualTo("Home");

        ArgumentCaptor<HouseholdMember> captor = ArgumentCaptor.forClass(HouseholdMember.class);
        verify(householdMemberRepository).save(captor.capture());
        HouseholdMember member = captor.getValue();
        assertThat(member.householdId()).isEqualTo(HOUSEHOLD_ID);
        assertThat(member.userId()).isEqualTo(OWNER_ID);
        assertThat(member.role()).isEqualTo(MembershipRole.OWNER);
    }

    @Test
    void createUsesTheSameTimestampForHouseholdAndMembership() {
        when(householdRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(householdMemberRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        householdService.create(new CreateHouseholdCommand(HOUSEHOLD_ID, OWNER_ID, "Home"));

        ArgumentCaptor<Household> householdCaptor = ArgumentCaptor.forClass(Household.class);
        verify(householdRepository).save(householdCaptor.capture());
        ArgumentCaptor<HouseholdMember> memberCaptor = ArgumentCaptor.forClass(HouseholdMember.class);
        verify(householdMemberRepository).save(memberCaptor.capture());
        assertThat(memberCaptor.getValue().createdAt()).isEqualTo(householdCaptor.getValue().createdAt());
    }

    @Test
    void createRejectsAHouseholdIdThatAlreadyExists() {
        when(householdRepository.save(any())).thenThrow(new IllegalStateException("duplicate key"));

        assertThatThrownBy(() -> householdService.create(new CreateHouseholdCommand(HOUSEHOLD_ID, OWNER_ID, "Home")))
            .isInstanceOf(IllegalStateException.class);
        verify(householdMemberRepository, never()).save(any());
    }

    @Test
    void listReturnsOnlyHouseholdsOwnedByTheUser() {
        Household owned = household(OWNER_ID);
        when(householdRepository.findAllByOwnerUserId(OWNER_ID)).thenReturn(List.of(owned));
        when(householdRepository.findAllByOwnerUserId(OTHER_USER_ID)).thenReturn(List.of());

        assertThat(householdService.list(OWNER_ID)).containsExactly(owned);
        assertThat(householdService.list(OTHER_USER_ID)).isEmpty();
    }

    @Test
    void getReturnsTheHouseholdWhenOwnedByTheUser() {
        Household owned = household(OWNER_ID);
        when(householdRepository.findByIdAndOwnerUserId(HOUSEHOLD_ID, OWNER_ID)).thenReturn(Optional.of(owned));

        assertThat(householdService.get(OWNER_ID, HOUSEHOLD_ID)).isEqualTo(owned);
    }

    @Test
    void getThrowsNotFoundWhenTheHouseholdBelongsToAnotherUser() {
        when(householdRepository.findByIdAndOwnerUserId(HOUSEHOLD_ID, OTHER_USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> householdService.get(OTHER_USER_ID, HOUSEHOLD_ID))
            .isInstanceOf(HouseholdNotFoundException.class);
    }

    @Test
    void getThrowsNotFoundWhenTheHouseholdDoesNotExist() {
        when(householdRepository.findByIdAndOwnerUserId(HOUSEHOLD_ID, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> householdService.get(OWNER_ID, HOUSEHOLD_ID))
            .isInstanceOf(HouseholdNotFoundException.class);
    }

    private Household household(UUID ownerUserId) {
        OffsetDateTime now = OffsetDateTime.now();
        return Household.builder()
            .id(HOUSEHOLD_ID)
            .ownerUserId(ownerUserId)
            .name("Home")
            .createdAt(now)
            .updatedAt(now)
            .build();
    }
}
