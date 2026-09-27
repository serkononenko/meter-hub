package com.meterhub.household.domain.model;

/**
 * Membership role inside a household. Ordered by capability level: the
 * role hierarchy is OWNER &gt; MEMBER &gt; VIEWER, see
 * docs/spec/4_membership_roles_spec.md section 3.
 */
public enum MembershipRole {
    OWNER,
    MEMBER,
    VIEWER;

    /** Whether this role satisfies a requirement of at least {@code required}. */
    public boolean satisfies(MembershipRole required) {
        return this.ordinal() <= required.ordinal();
    }
}
