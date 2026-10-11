/* Generated from contracts/events/ — do not edit. */

/**
 * Published by provider-service (via outbox) when a meter is bound to a provider account or a binding is ended. A full state snapshot of the binding; consumers discard one whose version is not newer than the one they hold. Keyed by meterId, so a meter's bindings stay ordered within the partition.
 */
export interface ProviderBindingChanged {
  /**
   * Stable event identifier, == outbox row id; the dedup key on the consumer side.
   */
  eventId: string;
  eventType: "provider.binding.changed";
  eventVersion: 1;
  occurredAt: string;
  producer: "provider-service";
  data: {
    bindingId: string;
    accountId: string;
    householdId: string;
    meterId: string;
    validFrom: string;
    /**
     * Last day the binding applies; null while open-ended.
     */
    validTo: string | null;
    /**
     * Per-binding counter, incremented on every change.
     */
    version: number;
  };
}
