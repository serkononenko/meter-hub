package com.meterhub.identity.domain.model;

import java.time.OffsetDateTime;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

public record User(
    UUID id,
    String email,
    String username,
    String passwordHash,
    AccountStatus status,
    SystemRole role,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    /**
     * The roles carried in the access token's {@code roles} claim. A single
     * stored role expands to a set: every account is a USER, and ADMIN is
     * additive — so adding a role later is not a breaking change for readers
     * of the claim.
     */
    public Set<SystemRole> systemRoles() {
        Set<SystemRole> roles = EnumSet.of(SystemRole.USER);
        roles.add(role);
        return roles;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private UUID id;
        private String email;
        private String username;
        private String passwordHash;
        private AccountStatus status;
        private SystemRole role = SystemRole.USER;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;

        public Builder id(UUID id) {
            this.id = id;
            return this;
        }

        public Builder email(String email) {
            this.email = email;
            return this;
        }

        public Builder username(String username) {
            this.username = username;
            return this;
        }

        public  Builder passwordHash(String passwordHash) {
            this.passwordHash = passwordHash;
            return this;
        }

        public Builder status(AccountStatus status) {
            this.status = status;
            return this;
        }

        public Builder role(SystemRole role) {
            this.role = role;
            return this;
        }

        public Builder createdAt(OffsetDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder updatedAt(OffsetDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        public User build() {
            return new User(id, email, username, passwordHash, status, role, createdAt, updatedAt);
        }
    }
}
