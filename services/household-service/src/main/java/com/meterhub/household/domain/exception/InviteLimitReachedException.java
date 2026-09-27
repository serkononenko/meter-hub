package com.meterhub.household.domain.exception;

/** The household already holds the maximum number of live invitations. */
public class InviteLimitReachedException extends RuntimeException {
    public InviteLimitReachedException() {
        super("The household already has the maximum number of live invites.");
    }
}
