-- Processed event IDs for the demo consumer (spec 5 §8): the dedup half of
-- the at-least-once contract. The consumer inserts the eventId BEFORE
-- processing, so a redelivery (broker retry, consumer restart mid-batch,
-- outbox produce-before-mark replay) is recognized and skipped. Survives
-- consumer restarts — the dedup guarantee spans `docker compose down && up`
-- (spec §12 acceptance).
CREATE TABLE "processed_events" (
    "event_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);
