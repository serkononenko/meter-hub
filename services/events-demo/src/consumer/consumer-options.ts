/**
 * Retry/DLQ policy knobs (spec 5 §9, conventions §15). Defaults are the
 * policy values from conventions §15 — a consumer overrides them only with
 * a reason written down next to the override.
 */
export interface RetryPolicy {
    /** Total attempts per message (first delivery + retries). */
    attempts: number;
    /** Base delay for the exponential backoff: delay = base * 2^(attempt-1). */
    baseDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
    attempts: 4,
    baseDelayMs: 250,
};
