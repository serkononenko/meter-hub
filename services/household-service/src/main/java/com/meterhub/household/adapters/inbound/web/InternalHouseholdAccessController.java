package com.meterhub.household.adapters.inbound.web;

import com.meterhub.household.adapters.inbound.web.api.InternalApi;
import com.meterhub.household.adapters.inbound.web.dto.HouseholdAccessDto;
import com.meterhub.household.adapters.inbound.web.dto.HouseholdRoleDto;
import com.meterhub.household.ports.inbound.GetHouseholdAccessUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Internal service-to-service surface (meter/reading services). No JWT —
 * trust model matches the A4 revocation feed until A1 lands; never proxied
 * by the gateway.
 */
@RestController
public class InternalHouseholdAccessController implements InternalApi {

    private final GetHouseholdAccessUseCase getHouseholdAccessUseCase;

    public InternalHouseholdAccessController(GetHouseholdAccessUseCase getHouseholdAccessUseCase) {
        this.getHouseholdAccessUseCase = getHouseholdAccessUseCase;
    }

    @Override
    public ResponseEntity<HouseholdAccessDto> getHouseholdAccess(UUID householdId, UUID userId,
                                                                 UUID xCorrelationID) {
        HouseholdAccessDto dto = new HouseholdAccessDto(false);
        getHouseholdAccessUseCase.getAccess(householdId, userId).ifPresent(role -> {
            dto.setExists(true);
            dto.setRole(HouseholdRoleDto.valueOf(role.name()));
        });
        return ResponseEntity.ok(dto);
    }
}
