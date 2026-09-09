package com.meterhub.household.domain.model;

import java.time.OffsetDateTime;
import java.util.UUID;

public record Household(
    UUID id,
    UUID ownerUserId,
    String name,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private UUID id;
        private UUID ownerUserId;
        private String name;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;

        public Builder id(UUID id) {
            this.id = id;
            return this;
        }

        public Builder ownerUserId(UUID ownerUserId) {
            this.ownerUserId = ownerUserId;
            return this;
        }

        public Builder name(String name) {
            this.name = name;
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

        public Household build() {
            return new Household(id, ownerUserId, name, createdAt, updatedAt);
        }
    }
}
