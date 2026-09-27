/* Backlog A3: multi-member households with roles, plus invitation codes. */

-- Roles broaden from OWNER-only to OWNER/MEMBER/VIEWER. MVP rows are all
-- OWNER (role was a plain VARCHAR with no check constraint), so adding the
-- constraint needs no data change.
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_role_check"
    CHECK ("role" IN ('OWNER', 'MEMBER', 'VIEWER'));

-- MVP enforced "exactly one member per household" with UNIQUE (household_id).
-- A3 allows several members but still at most one membership per
-- (household, user) pair. The constraint drop is runtime-only: jOOQ's
-- DDLDatabase codegen cannot simulate DROP CONSTRAINT, so it is wrapped in
-- ignore comments and the final table shape is expressed directly below.
/*[ignore]*/
ALTER TABLE "household_members" DROP CONSTRAINT "household_members_household_id_key";
/*[/ignore]*/
ALTER TABLE "household_members" ADD CONSTRAINT uq_household_members_household_user
    UNIQUE ("household_id", "user_id");

-- Invitation codes: single-use, expiring, stored hashed (same discipline as
-- identity's refresh tokens). The plaintext code is returned exactly once at
-- creation and never persisted.
CREATE TABLE "household_invites"
(
    "id"           UUID PRIMARY KEY,
    "household_id" UUID         NOT NULL,
    "role"         VARCHAR(20)  NOT NULL CHECK ("role" IN ('MEMBER', 'VIEWER')),
    "code_hash"    VARCHAR(64)  NOT NULL UNIQUE,
    "created_by"   UUID         NOT NULL,
    "expires_at"   TIMESTAMPTZ  NOT NULL,
    "redeemed_at"  TIMESTAMPTZ,
    "redeemed_by"  UUID,
    "revoked_at"   TIMESTAMPTZ,
    "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

/*[ignore]*/
ALTER TABLE "household_invites" ADD CONSTRAINT fk_household_invites_household_id
    FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE;

-- Bounded live invites per household: counting live rows
-- (redeemed_at IS NULL AND revoked_at IS NULL AND expires_at > now())
-- is cheap with this partial index.
CREATE INDEX ix_household_invites_household_live
    ON household_invites (household_id)
    WHERE "redeemed_at" IS NULL AND "revoked_at" IS NULL;
/*[/ignore]*/
