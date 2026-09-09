package com.meterhub.household.adapters.inbound.web.mappers;

import com.meterhub.household.adapters.inbound.web.dto.HouseholdDto;
import com.meterhub.household.domain.model.Household;

import java.util.List;

public final class HouseholdMapper {

    private HouseholdMapper() {
    }

    public static HouseholdDto toDto(Household household) {
        var dto = new HouseholdDto(
            household.id(),
            household.name(),
            household.createdAt()
        );
        dto.setUpdatedAt(household.updatedAt());
        return dto;
    }

    public static List<HouseholdDto> toDtoList(List<Household> households) {
        return households.stream()
            .map(HouseholdMapper::toDto)
            .toList();
    }
}
