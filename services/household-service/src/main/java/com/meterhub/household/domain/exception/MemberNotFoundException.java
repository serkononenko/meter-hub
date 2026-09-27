package com.meterhub.household.domain.exception;

/** The referenced user has no membership in the household. */
public class MemberNotFoundException extends RuntimeException {
    public MemberNotFoundException() {
        super("The referenced user has no membership in this household.");
    }
}
