package com.meterhub.household.domain.exception;

/** The invitation is past its expiry; codes are never extended. */
public class InviteExpiredException extends RuntimeException {
    public InviteExpiredException() {
        super("This invitation has expired.");
    }
}
