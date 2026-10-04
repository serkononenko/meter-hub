-- @param {String} $1:keyHash
SELECT "key_hash", "fingerprint", "owner", "response", "expires_at"
FROM "idempotency_keys"
WHERE "key_hash" = $1
