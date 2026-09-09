package com.meterhub.household.domain.exception;

/**
 * Thrown when the requested household does not exist or is not visible
 * to the authenticated user. Both cases map to the same 404 so callers
 * cannot infer whether a household id belongs to another user.
 */
public class HouseholdNotFoundException extends RuntimeException {
    public HouseholdNotFoundException() {
        super("Household not found");
    }
}
