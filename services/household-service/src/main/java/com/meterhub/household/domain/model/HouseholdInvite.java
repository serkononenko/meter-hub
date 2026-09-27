package com.meterhub.household.domain.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A single-use invitation to join a household. The plaintext code exists
 * only at creation; this model carries its hash.
 */
public record HouseholdInvite(
    UUID id,
    UUID householdId,
    InviteRole role,
    String codeHash,
    UUID createdBy,
    OffsetDateTime expiresAt,
    OffsetDateTime redeemedAt,
    UUID redeemedBy,
    OffsetDateTime revokedAt,
    OffsetDateTime createdAt
) {
    /** Roles an invitation can grant. OWNER is never invitiable. */
    public enum InviteRole {
        MEMBER, VIEWER;

        public MembershipRole toMembershipRole() {
            return MembershipRole.valueOf(name());
        }

        public static InviteRole fromMembershipRole(MembershipRole role) {
            if (role == MembershipRole.OWNER) {
                throw new IllegalArgumentException("OWNER is never invitiable");
            }
            return InviteRole.valueOf(role.name());
        }
    }

    /** Whether the invite can still be redeemed right now. */
    public boolean isLive(OffsetDateTime now) {
        return redeemedAt == null && revokedAt == null && expiresAt.isAfter(now);
    }

    public static Builder builder() {
        return new Builder();
    }

    public Builder toBuilder() {
        return new Builder()
            .id(id)
            .householdId(householdId)
            .role(role)
            .codeHash(codeHash)
            .createdBy(createdBy)
            .expiresAt(expiresAt)
            .redeemedAt(redeemedAt)
            .redeemedBy(redeemedBy)
            .revokedAt(revokedAt)
            .createdAt(createdAt);
    }

    public static class Builder {
        private UUID id;
        private UUID householdId;
        private InviteRole role;
        private String codeHash;
        private UUID createdBy;
        private OffsetDateTime expiresAt;
        private OffsetDateTime redeemedAt;
        private UUID redeemedBy;
        private OffsetDateTime revokedAt;
        private OffsetDateTime createdAt;

        public Builder id(UUID id) { this.id = id; return this; }
        public Builder householdId(UUID householdId) { this.householdId = householdId; return this; }
        public Builder role(InviteRole role) { this.role = role; return this; }
        public Builder codeHash(String codeHash) { this.codeHash = codeHash; return this; }
        public Builder createdBy(UUID createdBy) { this.createdBy = createdBy; return this; }
        public Builder expiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; return this; }
        public Builder redeemedAt(OffsetDateTime redeemedAt) { this.redeemedAt = redeemedAt; return this; }
        public Builder redeemedBy(UUID redeemedBy) { this.redeemedBy = redeemedBy; return this; }
        public Builder revokedAt(OffsetDateTime revokedAt) { this.revokedAt = revokedAt; return this; }
        public Builder createdAt(OffsetDateTime createdAt) { this.createdAt = createdAt; return this; }

        public HouseholdInvite build() {
            return new HouseholdInvite(id, householdId, role, codeHash, createdBy,
                expiresAt, redeemedAt, redeemedBy, revokedAt, createdAt);
        }
    }
}
