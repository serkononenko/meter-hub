-- Idempotency v2 (backlog A5): the hand-rolled find-then-save store is
-- replaced by @nestjs/idempotency with a Prisma store implementing its
-- IdempotencyStore contract. The table shape follows the package's
-- documented PostgreSQL layout (docs: reliability/idempotency):
--
-- - key_hash: sha256 of the store key (scope + client key), the PK.
-- - owner: the in-flight lock holder (a per-attempt fencing token); NULL
--   once the response is recorded.
-- - response: json, NOT jsonb — jsonb rejects "\u0000" in strings, and a
--   response body is arbitrary client-shaped JSON.
-- - expires_at: epoch milliseconds (bigint). An expired lock or record
--   "does not exist": acquire() may take it over, so no cleanup cron is
--   required for correctness; pruning is opportunistic.
--
-- The old table is dropped rather than migrated: records live 24h, the
-- deployment is single-node local, and a replay miss after deploy just
-- means a retried client re-submits and gets the standard uniqueness
-- behavior. (key_hash) and (owner, expires_at) can't be derived from the
-- old columns' hashes anyway.
DROP TABLE "idempotency_keys";

CREATE TABLE "idempotency_keys" (
    "key_hash" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "owner" TEXT,
    "response" JSON,
    "expires_at" BIGINT NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key_hash")
);

-- Expired-row takeover and opportunistic pruning look up rows by expiry.
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");
