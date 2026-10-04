-- @param {BigInt} $1:now
-- @param {Int} $2:limitRows
DELETE FROM "idempotency_keys"
WHERE "key_hash" IN (
    SELECT "key_hash" FROM "idempotency_keys" WHERE "expires_at" <= $1 LIMIT $2
)
AND "expires_at" <= $1
RETURNING "key_hash"
