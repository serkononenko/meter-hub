/* Backlog-adjacent (spec 6 §5): platform-level system roles, separate from
   household membership roles. Every existing account becomes USER; ADMIN is
   granted only by deployment configuration (IDENTITY_ADMIN_USER_IDS). */
ALTER TABLE "users" ADD COLUMN "role" VARCHAR(20) NOT NULL DEFAULT 'USER';
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('USER', 'ADMIN'));
