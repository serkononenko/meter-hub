CREATE TABLE "provider_outbox" (
    "id" UUID NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "traceparent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "provider_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "provider_outbox_published_at_created_at_idx" ON "provider_outbox"("published_at", "created_at");
