import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {EventEmitter2} from '@nestjs/event-emitter';
import {Interval} from '@nestjs/schedule';
import {KafkaProducerService} from '../events/kafka-producer.service.js';
import {OutboxRepository} from './outbox.repository.js';
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

import type {OutboxEntry} from './outbox.repository.js';


const BATCH_SIZE = 100;
const POLL_INTERVAL_MS = 500;

// At-least-once: a crash between produce and mark republishes on restart, and consumers dedup on eventId.
@Injectable()
export class OutboxRelay {
    private readonly logger = new Logger(OutboxRelay.name);
    private running = false;

    constructor(
        private readonly outbox: OutboxRepository,
        private readonly producer: KafkaProducerService,
        private readonly events: EventEmitter2,
        private readonly config: ConfigService,
    ) {
    }

    @Interval(POLL_INTERVAL_MS)
    async tick(): Promise<void> {
        if (this.config.get<boolean>('outbox.relayEnabled') !== false) {
            await this.relayRound();
        }
    }

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

    private async publishBatch(batch: OutboxEntry[]): Promise<void> {
        const published: string[] = [];
        for (const entry of batch) {
            try {
                await this.producer.send(entry.eventType, entry.aggregateKey, entry.payload, entry.traceparent);
                published.push(entry.id);
            } catch (error) {
                this.events.emit(OUTBOX_PUBLISH_FAILED, new OutboxPublishFailed(entry.id));
                this.logger.warn(
                    `publish failed for event ${entry.id} (stays unpublished, FIFO order may slip): ` +
                    `${error instanceof Error ? error.message : error}`,
                );
                // Stopping at the first failure keeps FIFO order for the rest of the batch.
                break;
            }
        }
        if (published.length > 0) {
            await this.outbox.markPublished(published);
            this.events.emit(OUTBOX_BATCH_PUBLISHED, new OutboxBatchPublished(published.length));
        }
    }
}
