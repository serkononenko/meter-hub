package com.meterhub.identity.domain.model;

/**
 * Platform-level role of an account. Deliberately unrelated to household
 * membership roles (OWNER/MEMBER/VIEWER), which Household Service owns and
 * resolves per request — a system role grants nothing inside a household.
 */
public enum SystemRole {
    USER,
    ADMIN
}
