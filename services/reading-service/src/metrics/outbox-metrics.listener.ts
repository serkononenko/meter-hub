import {Injectable} from '@nestjs/common';
import {Counter, Gauge} from 'prom-client';
import {OnEvent} from '@nestjs/event-emitter';
import {
    OUTBOX_BATCH_PUBLISHED,
    OUTBOX_PUBLISH_FAILED,
    OUTBOX_ROUND_COMPLETED,
    OUTBOX_ROUND_FAILED,
} from '../reading/outbox.events.js';
import {MetricsService} from './metrics.service.js';

import type {
    OutboxRoundCompleted,
    OutboxRoundFailed,
    OutboxBatchPublished,
    OutboxPublishFailed,
} from '../reading/outbox.events.js';


@Injectable()
export class OutboxMetricsListener {
    private readonly outboxBacklog: Gauge<string>;
    private readonly outboxPublished: Counter<string>;
    private readonly outboxPublishErrors: Counter<string>;
    private readonly outboxRoundErrors: Counter<string>;

    constructor(metrics: MetricsService) {
        this.outboxBacklog = new Gauge({
            name: 'reading_outbox_unpublished',
            help: 'Outbox rows not yet published to Kafka',
            registers: [metrics.registry],
        });
        this.outboxPublished = new Counter({
            name: 'reading_outbox_published_total',
            help: 'Outbox events published to Kafka',
            registers: [metrics.registry],
        });
        this.outboxPublishErrors = new Counter({
            name: 'reading_outbox_publish_errors_total',
            help: 'Outbox relay publish failures (event stays unpublished)',
            registers: [metrics.registry],
        });
        this.outboxRoundErrors = new Counter({
            name: 'reading_outbox_round_errors_total',
            help: 'Outbox relay rounds that failed (DB, broker connectivity, …)',
            registers: [metrics.registry],
        });
    }

    @OnEvent(OUTBOX_ROUND_COMPLETED)
    onRoundCompleted(payload: OutboxRoundCompleted): void {
        this.outboxBacklog.set(payload.backlog);
    }

    @OnEvent(OUTBOX_ROUND_FAILED)
    onRoundFailed(_payload: OutboxRoundFailed): void {
        this.outboxRoundErrors.inc();
    }

    @OnEvent(OUTBOX_BATCH_PUBLISHED)
    onBatchPublished(payload: OutboxBatchPublished): void {
        this.outboxPublished.inc(payload.count);
    }

    @OnEvent(OUTBOX_PUBLISH_FAILED)
    onPublishFailed(_payload: OutboxPublishFailed): void {
        this.outboxPublishErrors.inc();
    }
}
