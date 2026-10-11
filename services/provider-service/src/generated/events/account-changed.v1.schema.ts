/* Generated from contracts/events/ — do not edit. */

/**
 * Published by provider-service (via outbox) whenever a provider account is created, its rule or provider changes, or it is archived. A full state snapshot, not a delta: consumers rebuild their view from any sequence of these and discard a snapshot whose version is not newer than the one they hold. Keyed by accountId, so per-account order is preserved within the partition.
 */
export interface ProviderAccountChanged {
  /**
   * Stable event identifier, == outbox row id; the dedup key on the consumer side.
   */
  eventId: string;
  eventType: "provider.account.changed";
  eventVersion: 1;
  occurredAt: string;
  producer: "provider-service";
  data: {
    accountId: string;
    providerId: string;
    householdId: string;
    /**
     * Per-account counter, incremented on every change.
     */
    version: number;
    rule: SubmissionRule;
    archived: boolean;
  };
}
export interface SubmissionRule {
  cycle: "MONTHLY";
  opens: DaySpec;
  closes: DaySpec;
  /**
   * IANA time zone name.
   */
  timezone: string;
}
export interface DaySpec {
  kind: "DAY_OF_MONTH" | "LAST_DAY";
  day?: number;
  offsetDays?: number;
}
