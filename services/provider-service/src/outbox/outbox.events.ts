export class OutboxRoundCompleted {
    constructor(public readonly backlog: number) {}
}

export class OutboxRoundFailed {
    constructor(public readonly reason: string) {}
}

export class OutboxBatchPublished {
    constructor(public readonly count: number) {}
}

export class OutboxPublishFailed {
    constructor(public readonly eventId: string) {}
}

export const OUTBOX_ROUND_COMPLETED = 'provider.outbox.round_completed';
export const OUTBOX_ROUND_FAILED = 'provider.outbox.round_failed';
export const OUTBOX_BATCH_PUBLISHED = 'provider.outbox.batch_published';
export const OUTBOX_PUBLISH_FAILED = 'provider.outbox.publish_failed';
