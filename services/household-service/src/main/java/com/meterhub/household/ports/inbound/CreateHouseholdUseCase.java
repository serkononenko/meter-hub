package com.meterhub.household.ports.inbound;

import com.meterhub.household.application.command.CreateHouseholdCommand;
import com.meterhub.household.domain.model.Household;

public interface CreateHouseholdUseCase {
    Household create(CreateHouseholdCommand command);
}
