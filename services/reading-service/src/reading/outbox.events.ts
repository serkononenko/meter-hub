/**
 * Domain events emitted by the outbox relay (spec 5 §5). The reading
 * aggregate speaks in domain terms; observability (metrics listener),
 * audit logging, etc. subscribe without the relay knowing about them.
 */

/** A relay round finished successfully; carries the unpublished backlog. */
export class OutboxRoundCompleted {
    constructor(
        /** Outbox rows not yet published to Kafka. */
        public readonly backlog: number,
    ) {}
}

/** A relay round crashed (DB, broker connectivity, …) and will be retried. */
export class OutboxRoundFailed {
    constructor(
        /** Human-readable failure reason (error message). */
        public readonly reason: string,
    ) {}
}

/** A batch of outbox events reached Kafka. */
export class OutboxBatchPublished {
    constructor(
        /** How many events the batch contained. */
        public readonly count: number,
    ) {}
}

/** An outbox event failed to publish; it stays unpublished for retry. */
export class OutboxPublishFailed {
    constructor(
        /** Id of the event that failed. */
        public readonly eventId: string,
    ) {}
}

export const OUTBOX_ROUND_COMPLETED = 'reading.outbox.round_completed';
export const OUTBOX_ROUND_FAILED = 'reading.outbox.round_failed';
export const OUTBOX_BATCH_PUBLISHED = 'reading.outbox.batch_published';
export const OUTBOX_PUBLISH_FAILED = 'reading.outbox.publish_failed';
