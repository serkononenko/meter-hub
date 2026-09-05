package com.meterhub.identity.domain.exception;

/**
 * Thrown when a user cannot be created because an account with the same
 * email or username already exists. {@code field} is "email" or "username".
 */
public class DuplicateIdentityException extends RuntimeException {
    private final String field;

    public DuplicateIdentityException(String field) {
        super("Duplicate identity for field: " + field);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
