package com.meterhub.household.adapters.inbound.web;

import com.meterhub.household.ports.inbound.CreateHouseholdUseCase;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HouseholdController {
    private final CreateHouseholdUseCase createHouseholdUseCase;

    public HouseholdController(CreateHouseholdUseCase createHouseholdUseCase) {
        this.createHouseholdUseCase = createHouseholdUseCase;
    }
}
