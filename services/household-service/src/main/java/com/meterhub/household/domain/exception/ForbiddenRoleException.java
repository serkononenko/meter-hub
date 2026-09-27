package com.meterhub.household.domain.exception;

/**
 * The caller has a membership, but not the role the operation requires.
 * Distinguishable from {@link HouseholdAccessDeniedException}, which means
 * "not a member at all".
 */
public class ForbiddenRoleException extends RuntimeException {
    public ForbiddenRoleException() {
        super("Your role in this household does not permit this operation.");
    }
}
