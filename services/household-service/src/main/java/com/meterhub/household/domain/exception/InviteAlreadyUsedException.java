package com.meterhub.household.domain.exception;

/** The invitation has already been redeemed; codes are single-use. */
public class InviteAlreadyUsedException extends RuntimeException {
    public InviteAlreadyUsedException() {
        super("This invitation has already been redeemed.");
    }
}
