-- Backlog D1: actor tracking on meters. Nullable — rows that predate this
-- migration have no known actor.
ALTER TABLE "meters" ADD COLUMN "created_by" UUID;
ALTER TABLE "meters" ADD COLUMN "updated_by" UUID;
