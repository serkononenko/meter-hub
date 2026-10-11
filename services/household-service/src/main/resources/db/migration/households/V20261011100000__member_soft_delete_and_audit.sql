/* Backlog D1: member removal becomes a soft delete, with actor tracking. */

-- created_by: who granted the membership (the owner for the creator's own row,
-- the invite's creator for redeemed invites). Nullable: rows that predate this
-- migration are backfilled below only where the actor is known.
-- removed_at / removed_by: a non-null removed_at means the membership is gone;
-- every live-membership read filters on removed_at IS NULL.
ALTER TABLE "household_members" ADD COLUMN "created_by" UUID;
ALTER TABLE "household_members" ADD COLUMN "removed_at" TIMESTAMPTZ;
ALTER TABLE "household_members" ADD COLUMN "removed_by" UUID;

-- Pre-existing OWNER rows were created by the owner themself.
UPDATE "household_members" SET "created_by" = "user_id" WHERE "role" = 'OWNER';

-- One *live* membership per (household, user): a removed member can be
-- re-added (new row) without colliding with their tombstone. The partial
-- index and the constraint drop are runtime-only — jOOQ's DDLDatabase (H2)
-- parses neither, and the generated table shape does not depend on them.
/*[ignore]*/
ALTER TABLE "household_members" DROP CONSTRAINT "uq_household_members_household_user";
CREATE UNIQUE INDEX uq_household_members_live_household_user
    ON "household_members" ("household_id", "user_id")
    WHERE "removed_at" IS NULL;
/*[/ignore]*/
