import {Injectable, Logger} from '@nestjs/common';
import {Interval} from '@nestjs/schedule';
import {EventEmitter2} from '@nestjs/event-emitter';
import {OutboxRepository} from './outbox.repository.js';
import {KafkaProducerService} from '../events/kafka-producer.service.js';
import {
    OUTBOX_BATCH_PUBLISHED,
    OUTBOX_PUBLISH_FAILED,
    OUTBOX_ROUND_COMPLETED,
    OUTBOX_ROUND_FAILED,
    OutboxBatchPublished,
    OutboxPublishFailed,
    OutboxRoundCompleted,
    OutboxRoundFailed,
} from './outbox.events.js';

export const READING_CREATED_TOPIC = 'meter.reading.created';

const BATCH_SIZE = 100;
const POLL_INTERVAL_MS = 500;

/**
 * Outbox relay (spec 5 §5): polls unpublished rows, produces each to its
 * topic, marks published_at in one batch transaction. At-least-once by
 * construction — a crash between produce and mark re-publishes on
 * restart, and consumer-side dedup on eventId absorbs the redelivery.
 * Broker down → events queue in the table; the loop just retries.
 *
 * The relay knows nothing about observability: it emits domain events
 * (outbox.events.ts) and the metrics listener subscribes to them.
 */
@Injectable()
export class OutboxRelay {
    private readonly logger = new Logger(OutboxRelay.name);
    private running = false;

    constructor(
        private readonly outbox: OutboxRepository,
        private readonly producer: KafkaProducerService,
        private readonly events: EventEmitter2,
    ) {
    }

    @Interval(POLL_INTERVAL_MS)
    async relayRound(): Promise<void> {
        if (this.running) {
            return;
        }
        this.running = true;
        try {
            const batch = await this.outbox.findUnpublished(BATCH_SIZE);
            if (batch.length > 0) {
                await this.publishBatch(batch);
            }
            this.events.emit(OUTBOX_ROUND_COMPLETED, new OutboxRoundCompleted(await this.outbox.countUnpublished()));
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            this.logger.warn(`relay round failed, will retry: ${reason}`);
            this.events.emit(OUTBOX_ROUND_FAILED, new OutboxRoundFailed(reason));
        } finally {
            this.running = false;
        }
    }

    private async publishBatch(batch: Awaited<ReturnType<OutboxRepository['findUnpublished']>>): Promise<void> {
        const published: string[] = [];
        for (const entry of batch) {
            try {
                await this.producer.send(
                    READING_CREATED_TOPIC,
                    entry.payload.data.meterId,
                    entry.payload,
                    entry.traceparent,
                );
                published.push(entry.id);
            } catch (error) {
                this.events.emit(OUTBOX_PUBLISH_FAILED, new OutboxPublishFailed(entry.id));
                this.logger.warn(
                    `publish failed for event ${entry.id} (stays unpublished, FIFO order may slip): ` +
                    `${error instanceof Error ? error.message : error}`,
                );
                // Stop at first error keeps FIFO order for the rest of the
                // batch; the failed row is retried next round.
                break;
            }
        }
        if (published.length > 0) {
            await this.outbox.markPublished(published);
            this.events.emit(OUTBOX_BATCH_PUBLISHED, new OutboxBatchPublished(published.length));
        }
    }
}
