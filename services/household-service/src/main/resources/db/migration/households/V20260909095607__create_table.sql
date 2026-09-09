CREATE TABLE "households"
(
    "id"            UUID PRIMARY KEY,
    "owner_user_id" UUID         NOT NULL,
    "name"          VARCHAR(200) NOT NULL,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "household_members"
(
    "id"           UUID PRIMARY KEY,
    "household_id" UUID        NOT NULL UNIQUE,
    "user_id"      UUID        NOT NULL,
    "role"         VARCHAR(20) NOT NULL DEFAULT 'OWNER',
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

/*[ignore]*/
ALTER TABLE "household_members" ADD CONSTRAINT fk_household_members_household_id
    FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE;

CREATE INDEX ix_households_owner_user_id ON households (owner_user_id);
/*[/ignore]*/
