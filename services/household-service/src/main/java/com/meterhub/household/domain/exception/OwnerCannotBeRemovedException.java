package com.meterhub.household.domain.exception;

/** Removing the owner's membership is rejected; ownership never transfers. */
public class OwnerCannotBeRemovedException extends RuntimeException {
    public OwnerCannotBeRemovedException() {
        super("The household owner cannot be removed.");
    }
}
