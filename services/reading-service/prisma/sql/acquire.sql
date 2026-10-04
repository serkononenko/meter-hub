-- @param {String} $1:keyHash
-- @param {String} $2:key
-- @param {String} $3:fingerprint
-- @param {String} $4:owner
-- @param {BigInt} $5:lockDeadline
-- @param {BigInt} $6:now
INSERT INTO "idempotency_keys" ("key_hash", "key", "fingerprint", "owner", "response", "expires_at")
VALUES ($1, $2, $3, $4, NULL, $5)
ON CONFLICT ("key_hash") DO UPDATE
    SET "fingerprint" = EXCLUDED."fingerprint",
        "owner" = EXCLUDED."owner",
        "response" = NULL,
        "expires_at" = EXCLUDED."expires_at"
    WHERE "idempotency_keys"."expires_at" <= $6
RETURNING "key_hash"
