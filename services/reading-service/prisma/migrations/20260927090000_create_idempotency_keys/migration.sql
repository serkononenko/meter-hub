-- Idempotency records for retried POST /readings submissions (backlog C3).
-- The key is client-generated (UUID), scoped per user; response_body holds
-- the original response snapshot so a retry within the retention window
-- replays it instead of creating a second reading. expires_at backs the
-- cleanup query.
CREATE TABLE "idempotency_keys" (
    "key" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- Cleanup looks up expired keys; replay lookups go through the primary key.
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");
