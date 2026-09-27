package com.meterhub.household.domain.exception;

/**
 * The authenticated user has no membership in the referenced household.
 * Deliberately does not distinguish "household does not exist" — existence
 * is not revealed to non-members.
 */
public class HouseholdAccessDeniedException extends RuntimeException {
    public HouseholdAccessDeniedException() {
        super("You do not have access to this household.");
    }
}
