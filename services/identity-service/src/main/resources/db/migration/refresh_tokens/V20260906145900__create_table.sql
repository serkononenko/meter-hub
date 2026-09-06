CREATE TABLE "refresh_tokens"
(
    "id"         UUID PRIMARY KEY,
    "user_id"    UUID        NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL UNIQUE,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

/*[ignore]*/
ALTER TABLE "refresh_tokens" ADD CONSTRAINT fk_refresh_tokens_user_id
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
/*[/ignore]*/
