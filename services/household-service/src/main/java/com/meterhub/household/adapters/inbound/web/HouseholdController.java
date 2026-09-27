package com.meterhub.household.adapters.inbound.web;

import com.meterhub.household.adapters.inbound.web.api.HouseholdsApi;
import com.meterhub.household.adapters.inbound.web.dto.CreateHouseholdRequestDto;
import com.meterhub.household.adapters.inbound.web.dto.HouseholdDto;
import com.meterhub.household.adapters.inbound.web.mappers.HouseholdMapper;
import com.meterhub.household.application.command.CreateHouseholdCommand;
import com.meterhub.household.ports.inbound.CreateHouseholdUseCase;
import com.meterhub.household.ports.inbound.GetHouseholdUseCase;
import com.meterhub.household.ports.inbound.ListHouseholdsUseCase;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Adapter implementing generated {@link HouseholdsApi} contract.
 *
 * <p>Read endpoints scope every query by the caller's membership: the user
 * id comes from the JWT subject, use cases only expose membership-filtered
 * lookups, so a caller can never address a household they hold no
 * membership in by guessing ids.
 */
@RestController
public class HouseholdController implements HouseholdsApi {

    private final CreateHouseholdUseCase createHouseholdUseCase;
    private final ListHouseholdsUseCase listHouseholdsUseCase;
    private final GetHouseholdUseCase getHouseholdUseCase;
    private final SpringSecurityAuthProvider springSecurityAuthProvider;

    public HouseholdController(
        CreateHouseholdUseCase createHouseholdUseCase,
        ListHouseholdsUseCase listHouseholdsUseCase,
        GetHouseholdUseCase getHouseholdUseCase,
        SpringSecurityAuthProvider springSecurityAuthProvider
    ) {
        this.createHouseholdUseCase = createHouseholdUseCase;
        this.listHouseholdsUseCase = listHouseholdsUseCase;
        this.getHouseholdUseCase = getHouseholdUseCase;
        this.springSecurityAuthProvider = springSecurityAuthProvider;
    }

    @Override
    public ResponseEntity<HouseholdDto> createHousehold(CreateHouseholdRequestDto createHouseholdRequest,
                                                        UUID xCorrelationID) {
        CreateHouseholdCommand command = new CreateHouseholdCommand(
            UUID.randomUUID(),
            springSecurityAuthProvider.currentUserId(),
            createHouseholdRequest.getName()
        );
        var household = createHouseholdUseCase.create(command);
        // The creator is always OWNER (single immutable owner per household).
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(HouseholdMapper.toDto(household, com.meterhub.household.domain.model.MembershipRole.OWNER));
    }

    @Override
    public ResponseEntity<List<HouseholdDto>> listHouseholds(UUID xCorrelationID) {
        var households = listHouseholdsUseCase.list(springSecurityAuthProvider.currentUserId());
        return ResponseEntity.ok(HouseholdMapper.toDtoList(households));
    }

    @Override
    public ResponseEntity<HouseholdDto> getHousehold(UUID householdId, UUID xCorrelationID) {
        var withRole = getHouseholdUseCase.get(
            springSecurityAuthProvider.currentUserId(),
            householdId
        );
        return ResponseEntity.ok(HouseholdMapper.toDto(withRole));
    }
}
