package com.meterhub.household.domain.exception;

/**
 * An invitation code matches no live invitation. Used for unknown codes on
 * redeem, unknown invite ids on revoke, and to avoid revealing why a code
 * failed (unknown, revoked, or unknown household all map here; used and
 * expired have their own statuses).
 */
public class InviteNotFoundException extends RuntimeException {
    public InviteNotFoundException() {
        super("No invitation matches the supplied code.");
    }
}
