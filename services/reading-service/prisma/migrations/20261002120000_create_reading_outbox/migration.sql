-- Outbox rows for events produced by Reading Service (spec 5, Phase 2).
-- Written in the SAME transaction as the reading row, then published by
-- the OutboxRelay and marked with published_at. id doubles as the stable
-- eventId consumers dedup on; traceparent carries the creating request's
-- W3C trace context so Jaeger assembles one waterfall across the async leg.
CREATE TABLE "reading_outbox" (
    "id" UUID NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "traceparent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "reading_outbox_pkey" PRIMARY KEY ("id")
);

-- Relay scan: unpublished rows ordered by creation (FIFO publish per partition).
CREATE INDEX "reading_outbox_unpublished_idx"
    ON "reading_outbox"("created_at")
    WHERE "published_at" IS NULL;
