import {Injectable, Logger, OnModuleDestroy, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Consumer, EachMessagePayload, Kafka, Partitioners} from 'kafkajs';
import {PrismaService} from '../database/prisma.service.js';
import {StructuredLoggerService} from '../logging/structured-logger.service.js';
import {Prisma} from '../generated/prisma/client.js';
import {ConsumerMetrics} from './consumer-metrics.js';
import {DEFAULT_RETRY_POLICY, RetryPolicy} from './consumer-options.js';

export type MessageHandler = (payload: {
    eventId: string,
    eventType: string,
    traceparent: string | null,
    value: unknown,
}) => Promise<void>;

/**
 * Shared consumer loop (spec 5 §8/§9, conventions §15) — extracted so the
 * demo consumer and Phase 3+ consumers inherit one policy instead of
 * hand-rolling five. Per message:
 *
 *   1. dedup first — eventId checked/recorded in the store before the
 *      handler runs, so a redelivery (broker retry, restart mid-batch,
 *      outbox produce-before-mark replay) is a no-op;
 *   2. failure → bounded in-process exponential backoff retries;
 *   3. budget exhausted → publish to `<topic>.dlq` with failure headers
 *      (reason, attempts, last exception class), then commit and move on —
 *      a poisoned message cannot block the partition.
 *
 * The handler never sees offset management: the loop commits after
 * success or DLQ, never on retryable failure (the uncommitted offset is
 * what makes Kafka redeliver).
 */
@Injectable()
export class ConsumerLoop implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ConsumerLoop.name);
    protected readonly retryPolicy: RetryPolicy;
    // Built lazily in onModuleInit, not the constructor: constructing the
    // kafkajs client validates config eagerly, which forced tests to fake a
    // full Kafka config just to exercise the message pipeline.
    private kafka!: Kafka;
    private consumer!: Consumer;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly metrics: ConsumerMetrics,
        private readonly structuredLogger: StructuredLoggerService,
    ) {
        this.retryPolicy = this.config.get<RetryPolicy>('kafka.retryPolicy') ?? DEFAULT_RETRY_POLICY;
    }

    async onModuleInit(): Promise<void> {
        const topic = this.config.getOrThrow<string>('kafka.topic');
        this.kafka = new Kafka({
            clientId: 'events-demo',
            brokers: this.config.getOrThrow<string>('kafka.brokers').split(','),
        });
        this.consumer = this.kafka.consumer({groupId: this.config.getOrThrow<string>('kafka.groupId')});
        await this.ensureTopic(topic);
        await this.ensureTopic(`${topic}.dlq`);
        await this.consumer.subscribe({topic, fromBeginning: true});
        await this.consumer.run({
            eachMessage: (payload) => this.handleMessage(topic, payload),
        });
        this.logger.log(`Consumer running: topic=${topic} group=${this.config.getOrThrow<string>('kafka.groupId')}`);
    }

    async onModuleDestroy(): Promise<void> {
        if (this.consumer) {
            await this.consumer.disconnect();
        }
    }

    /**
     * Idempotent topic declaration (spec 5 §8): create if missing, accept
     * TOPIC_ALREADY_EXISTS otherwise. The DLQ is declared up front too, so
     * the first poison message never races its own topic's creation.
     */
    private async ensureTopic(topic: string): Promise<void> {
        const admin = this.kafka.admin();
        try {
            await admin.connect();
            await admin.createTopics({
                topics: [{topic}],
                // false (default): a concurrent/existing creation surfaces as an
                // error here and is accepted below rather than silently ignored.
                waitForLeaders: true,
            });
            this.logger.log(`Topic ready: ${topic}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('TOPIC_ALREADY_EXISTS')) {
                throw error;
            }
            this.logger.log(`Topic already exists: ${topic}`);
        } finally {
            await admin.disconnect();
        }
    }

    /** Per-message pipeline; public for the unit tests driving it directly. */
    async handleMessage(topic: string, payload: EachMessagePayload): Promise<void> {
        const message = payload.message;
        const eventId = message.headers?.['eventId']?.toString() ?? null;
        const traceparent = message.headers?.['traceparent']?.toString() ?? null;

        this.metrics.consumedTotal.inc();
        if (!eventId || !message.value) {
            // Unparseable envelope: no eventId to dedup on. Straight to DLQ
            // with the same header set — retrying can never fix a malformed
            // message, so the budget would only delay the inevitable.
            await this.deadLetter(topic, 'missing-eventId-or-value', 1, 'MalformedMessage', message.value?.toString() ?? null);
            return;
        }

        // Dedup first (spec 5 §8): record the eventId before processing. The
        // primary-key insert is the check-and-claim in one statement — a
        // redelivery loses the race and is skipped. The demo's only side
        // effect is a log line, so the insert alone is the "transaction"; a
        // real consumer puts its work and this insert in one DB transaction.
        let claimed: boolean;
        try {
            await this.prisma.processedEvent.create({
                data: {eventId, eventType: topic},
            });
            claimed = true;
        } catch (error) {
            // P2002 unique violation: already processed — that IS the dedup
            // hit; anything else is a real store failure and rethrows.
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
                throw error;
            }
            claimed = false;
        }
        if (!claimed) {
            this.metrics.dedupedTotal.inc();
            this.structuredLogger.log('Event already processed, skipping', {eventId, topic});
            return;
        }

        let value: unknown;
        try {
            value = JSON.parse(message.value.toString('utf-8'));
        } catch {
            await this.deadLetter(topic, 'unparseable-json', 1, 'ParseError', message.value.toString('utf-8'));
            return;
        }

        const {attempts, baseDelayMs} = this.retryPolicy;
        let lastError: unknown;
        let attempt = 0;

        while (attempt < attempts) {
            attempt += 1;
            try {
                await this.invokeHandler(eventId, topic, traceparent, value);
                this.metrics.processedTotal.inc();
                return;
            } catch (error) {
                lastError = error;
                this.metrics.failedTotal.inc();
                if (attempt < attempts) {
                    const delay = baseDelayMs * 2 ** (attempt - 1);
                    this.logger.warn(`processing failed (attempt ${attempt}/${attempts}), retrying in ${delay}ms: ${errorText(error)}`);
                    await this.sleep(delay);
                }
            }
        }

        await this.deadLetter(topic, errorText(lastError), attempts, lastError?.constructor?.name ?? 'Unknown', JSON.stringify(value));
    }

    /**
     * Expects `value` to be the envelope of a known event type; the
     * scaffolding stays type-agnostic, the demo's handler narrows it.
     */
    protected async invokeHandler(
        _eventId: string,
        _eventType: string,
        _traceparent: string | null,
        _value: unknown,
    ): Promise<void> {
        throw new Error('ConsumerLoop is abstract; register a handler');
    }

    /**
     * Policy step 3 (spec 5 §9): publish to `<topic>.dlq` with the failure
     * header set, then commit (kafkajs commits after eachMessage resolves)
     * and move on. The partition keeps flowing — conventions §15.
     */
    protected async deadLetter(
        topic: string,
        reason: string,
        attempts: number,
        exceptionClass: string,
        rawValue: string | null,
    ): Promise<void> {
        const producer = this.kafka.producer({createPartitioner: Partitioners.DefaultPartitioner});
        await producer.connect();
        try {
            await producer.send({
                topic: `${topic}.dlq`,
                messages: [{
                    key: reason,
                    value: rawValue,
                    headers: {
                        reason,
                        attempts: String(attempts),
                        exceptionClass,
                        originalTopic: topic,
                        deadLetteredAt: new Date().toISOString(),
                    },
                }],
            });
        } finally {
            await producer.disconnect();
        }
        this.metrics.dlqPublishedTotal.inc();
        this.structuredLogger.warn('Message dead-lettered', {topic, reason, attempts, exceptionClass});
    }

    /** Backoff wait between in-process retries. */
    protected async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
