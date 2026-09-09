package com.meterhub.household.application.command;

import java.util.UUID;

public record CreateHouseholdCommand(
    UUID householdId,
    UUID ownerUserId,
    String name
) {
}
