CREATE TABLE "revoked_access_tokens"
(
    "jti"        UUID PRIMARY KEY,
    "user_id"    UUID        NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

/*[ignore]*/
ALTER TABLE "revoked_access_tokens" ADD CONSTRAINT fk_revoked_access_tokens_user_id
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;

-- Feed pagination is strictly ascending on revoked_at.
CREATE INDEX ix_revoked_access_tokens_revoked_at ON "revoked_access_tokens" ("revoked_at");
/*[/ignore]*/
