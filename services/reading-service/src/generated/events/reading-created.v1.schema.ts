/* Generated from contracts/events/ — do not edit. */

/**
 * Published by reading-service (via outbox) when a reading is recorded. Consumed e.g. by reminders/notifications in later phases. Envelope rules (spec 5 §7): eventId is stable forever and unique per event (== outbox row id); breaking payload changes bump eventVersion and land on a new topic version; unit is denormalized from the meter so consumers never call back synchronously.
 */
export interface MeterReadingCreated {
  /**
   * Stable event identifier, == outbox row id; the dedup key on the consumer side.
   */
  eventId: string;
  eventType: "meter.reading.created";
  eventVersion: 1;
  /**
   * RFC3339 — the reading's createdAt.
   */
  occurredAt: string;
  producer: "reading-service";
  data: {
    readingId: string;
    meterId: string;
    /**
     * Recorded value in the meter's unit.
     */
    value: number;
    /**
     * Denormalized from the meter at publish time.
     */
    unit: "KWH" | "M3" | "L";
    recordedAt: string;
    /**
     * DEVICE arrives with Phase 6, mirroring the reading contract.
     */
    source: "MANUAL";
  };
}
