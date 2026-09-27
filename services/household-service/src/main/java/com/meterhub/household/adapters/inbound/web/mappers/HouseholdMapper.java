package com.meterhub.household.adapters.inbound.web.mappers;

import com.meterhub.household.adapters.inbound.web.dto.HouseholdDto;
import com.meterhub.household.adapters.inbound.web.dto.HouseholdRoleDto;
import com.meterhub.household.domain.model.Household;
import com.meterhub.household.domain.model.MembershipRole;
import com.meterhub.household.ports.outbound.HouseholdRepository;

import java.util.List;

public final class HouseholdMapper {

    private HouseholdMapper() {
    }

    public static HouseholdDto toDto(HouseholdRepository.HouseholdWithRole withRole) {
        return toDto(withRole.household(), withRole.role());
    }

    public static List<HouseholdDto> toDtoList(List<HouseholdRepository.HouseholdWithRole> households) {
        return households.stream()
            .map(HouseholdMapper::toDto)
            .toList();
    }

    public static HouseholdDto toDto(Household household, MembershipRole role) {
        var dto = new HouseholdDto(
            household.id(),
            household.name(),
            toRoleDto(role),
            household.createdAt()
        );
        dto.setUpdatedAt(household.updatedAt());
        return dto;
    }

    public static HouseholdRoleDto toRoleDto(MembershipRole role) {
        return HouseholdRoleDto.valueOf(role.name());
    }
}
