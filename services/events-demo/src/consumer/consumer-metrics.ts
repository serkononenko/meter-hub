import {Injectable} from '@nestjs/common';
import {Counter} from 'prom-client';
import type {Registry} from 'prom-client';

/**
 * Per-consumer metrics in the shared scaffolding (spec 5 §9): every
 * consumer built on the loop gets the same series names, so dashboards
 * and alert rules generalize. Registered on the service's own registry
 * (per-instance, mirroring MetricsService).
 */
@Injectable()
export class ConsumerMetrics {
    readonly consumedTotal: Counter<string>;
    readonly processedTotal: Counter<string>;
    readonly dedupedTotal: Counter<string>;
    readonly failedTotal: Counter<string>;
    readonly dlqPublishedTotal: Counter<string>;

    constructor(registry: Registry) {
        this.consumedTotal = new Counter({
            name: 'consumer_messages_consumed_total',
            help: 'Messages received from the topic, before dedup and processing.',
            registers: [registry],
        });
        this.processedTotal = new Counter({
            name: 'consumer_messages_processed_total',
            help: 'Messages processed successfully (first delivery, not deduped redeliveries).',
            registers: [registry],
        });
        this.dedupedTotal = new Counter({
            name: 'consumer_messages_deduped_total',
            help: 'Messages skipped as already-processed redeliveries.',
            registers: [registry],
        });
        this.failedTotal = new Counter({
            name: 'consumer_messages_failed_total',
            help: 'Messages whose processing threw (including every retry attempt).',
            registers: [registry],
        });
        this.dlqPublishedTotal = new Counter({
            name: 'consumer_dlq_messages_total',
            help: 'Messages dead-lettered after exhausting the retry budget.',
            registers: [registry],
        });
    }
}
