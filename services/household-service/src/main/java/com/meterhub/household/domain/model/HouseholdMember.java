package com.meterhub.household.domain.model;

import java.time.OffsetDateTime;
import java.util.UUID;

public record HouseholdMember(
    UUID id,
    UUID householdId,
    UUID userId,
    MembershipRole role,
    OffsetDateTime createdAt,
    UUID createdBy,
    OffsetDateTime removedAt,
    UUID removedBy
) {
    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private UUID id;
        private UUID householdId;
        private UUID userId;
        private MembershipRole role;
        private OffsetDateTime createdAt;
        private UUID createdBy;
        private OffsetDateTime removedAt;
        private UUID removedBy;

        public Builder id(UUID id) {
            this.id = id;
            return this;
        }

        public Builder householdId(UUID householdId) {
            this.householdId = householdId;
            return this;
        }

        public Builder userId(UUID userId) {
            this.userId = userId;
            return this;
        }

        public Builder role(MembershipRole role) {
            this.role = role;
            return this;
        }

        public Builder createdAt(OffsetDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder createdBy(UUID createdBy) {
            this.createdBy = createdBy;
            return this;
        }

        public Builder removedAt(OffsetDateTime removedAt) {
            this.removedAt = removedAt;
            return this;
        }

        public Builder removedBy(UUID removedBy) {
            this.removedBy = removedBy;
            return this;
        }

        public HouseholdMember build() {
            return new HouseholdMember(id, householdId, userId, role, createdAt, createdBy, removedAt, removedBy);
        }
    }
}
