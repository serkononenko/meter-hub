package com.meterhub.identity.domain.model;

/** Platform-level role; unrelated to household membership roles, which Household Service resolves per request. */
public enum SystemRole {
    USER,
    ADMIN
}
