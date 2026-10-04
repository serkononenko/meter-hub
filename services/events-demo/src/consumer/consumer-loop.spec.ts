import {describe, expect, it} from 'vitest';
import type {EachMessagePayload, KafkaMessage} from 'kafkajs';
import {ConsumerLoop} from './consumer-loop.js';
import {DEFAULT_RETRY_POLICY, RetryPolicy} from './consumer-options.js';
import {Prisma} from '../generated/prisma/client.js';

/**
 * Unit tests for the shared consumer loop policy (spec 5 §9, task K3.2):
 * poison message → DLQ after the retry budget while the next message still
 * processes; redelivery deduped; malformed messages straight to DLQ.
 *
 * ConsumerLoop is exercised through a test subclass that overrides the
 * protected seams (handler, DLQ sink, backoff wait) and fakes the Prisma
 * dedup store — the loop's policy logic is what's under test, not
 * kafkajs or the DB driver.
 */

const TOPIC = 'meter.reading.created';

type DlqRecord = {headers: Record<string, string>, value: string | null};

class TestableConsumerLoop extends ConsumerLoop {
    handler: (p: {eventId: string}) => Promise<void> = () => Promise.resolve();
    dlq: DlqRecord[] = [];
    sleepMs: number[] = [];
    store = new Set<string>();

    constructor(retryPolicy: RetryPolicy) {
        super(
            // config: only the retry policy matters; kafka clients are only
            // built in onModuleInit, which these tests never call.
            {get: () => retryPolicy, getOrThrow: () => ''} as never,
            // prisma: the dedup store — create() claims the eventId, a
            // repeat insert surfaces the P2002 unique violation.
            {
                processedEvent: {
                    create: async ({data}: {data: {eventId: string}}) => {
                        if (this.store.has(data.eventId)) {
                            throw new Prisma.PrismaClientKnownRequestError(
                                'Unique constraint failed on the fields: (event_id)',
                                {code: 'P2002', clientVersion: '7.10.0'},
                            );
                        }
                        this.store.add(data.eventId);
                        return data;
                    },
                },
            } as never,
            // metrics: counters with no-op inc() — the subclass overrides
            // the DLQ sink where the real ones are asserted via prom-client.
            {
                consumedTotal: {inc: () => undefined},
                processedTotal: {inc: () => undefined},
                dedupedTotal: {inc: () => undefined},
                failedTotal: {inc: () => undefined},
                dlqPublishedTotal: {inc: () => undefined},
            } as never,
            // structured logger: no-op so dedup-skip lines don't hit stdout.
            {log: () => undefined, warn: () => undefined} as never,
        );
    }

    protected override async invokeHandler(
        eventId: string,
        _eventType: string,
        _traceparent: string | null,
        _value: unknown,
    ): Promise<void> {
        return this.handler({eventId});
    }

    protected override deadLetter(
        _topic: string,
        reason: string,
        attempts: number,
        exceptionClass: string,
        rawValue: string | null,
    ): Promise<void> {
        this.dlq.push({headers: {reason, attempts: String(attempts), exceptionClass}, value: rawValue});
        return Promise.resolve();
    }

    protected override async sleep(ms: number): Promise<void> {
        this.sleepMs.push(ms); // no real waiting — keeps the test synchronous
    }
}

function message(eventId: string, body: object): KafkaMessage {
    return {
        key: Buffer.from('meter-1'),
        value: Buffer.from(JSON.stringify(body)),
        headers: {
            eventId: Buffer.from(eventId),
            traceparent: Buffer.from('00-11111111111111111111111111111111-2222222222222222-01'),
        },
    } as unknown as KafkaMessage;
}

function payload(eventId: string, body: object): EachMessagePayload {
    return {topic: TOPIC, partition: 0, message: message(eventId, body)} as unknown as EachMessagePayload;
}

const VALID_EVENT = {
    eventId: '00000000-0000-0000-0000-000000000000',
    eventType: 'meter.reading.created',
    eventVersion: 1,
    occurredAt: '2026-10-04T12:00:00Z',
    producer: 'reading-service',
    data: {readingId: 'r-1', meterId: 'm-1', value: 42, unit: 'KWH', recordedAt: '2026-10-04T12:00:00Z', source: 'MANUAL'},
};

describe('ConsumerLoop', () => {
    it('processes a valid message once and records it in the dedup store', async () => {
        const loop = new TestableConsumerLoop(DEFAULT_RETRY_POLICY);
        const event = {...VALID_EVENT, eventId: '11111111-1111-1111-1111-111111111111'};

        await loop.handleMessage(TOPIC, payload(event.eventId, event));

        expect(loop.handler).toBeDefined();
        expect(loop.store.size).toBe(1);
    });

    it('dedupes a redelivered event — handler invoked only on first delivery', async () => {
        const loop = new TestableConsumerLoop(DEFAULT_RETRY_POLICY);
        const event = {...VALID_EVENT, eventId: '22222222-2222-2222-2222-222222222222'};
        const calls: string[] = [];
        loop.handler = ({eventId}) => {
            calls.push(eventId);
            return Promise.resolve();
        };

        await loop.handleMessage(TOPIC, payload(event.eventId, event));
        await loop.handleMessage(TOPIC, payload(event.eventId, event));

        expect(calls).toEqual([event.eventId]);
        expect(loop.store.size).toBe(1);
    });

    it('dead-letters a poison message after the retry budget, then keeps processing the next message', async () => {
        const loop = new TestableConsumerLoop({attempts: 3, baseDelayMs: 10});
        const poison = {...VALID_EVENT, eventId: '33333333-3333-3333-3333-333333333333', data: {...VALID_EVENT.data, value: -1}};
        const healthy = {...VALID_EVENT, eventId: '44444444-4444-4444-4444-444444444444'};
        const attemptsByEvent: Record<string, number> = {};
        loop.handler = ({eventId}) => {
            attemptsByEvent[eventId] = (attemptsByEvent[eventId] ?? 0) + 1;
            if (eventId === poison.eventId) {
                return Promise.reject(new Error('boom'));
            }
            return Promise.resolve();
        };

        await loop.handleMessage(TOPIC, payload(poison.eventId, poison));
        await loop.handleMessage(TOPIC, payload(healthy.eventId, healthy));

        // Poison: exactly the budget's attempts, then DLQ with the header set.
        expect(attemptsByEvent[poison.eventId]).toBe(3);
        expect(loop.dlq).toEqual([{
            headers: {
                reason: 'boom',
                attempts: '3',
                exceptionClass: 'Error',
            },
            value: JSON.stringify(poison),
        }]);

        // Backoff shape: base * 2^(attempt-1) → 10ms then 20ms.
        expect(loop.sleepMs).toEqual([10, 20]);

        // The partition kept flowing: the healthy message processed after the poison.
        expect(attemptsByEvent[healthy.eventId]).toBe(1);
        expect(loop.store.has(healthy.eventId)).toBe(true);
    });

    it('sends a message missing its eventId header straight to DLQ (retrying cannot fix it)', async () => {
        const loop = new TestableConsumerLoop(DEFAULT_RETRY_POLICY);
        const p = {
            topic: TOPIC,
            partition: 0,
            message: {key: null, value: Buffer.from('{}'), headers: {}},
        } as unknown as EachMessagePayload;

        await loop.handleMessage(TOPIC, p);

        expect(loop.dlq).toHaveLength(1);
        expect(loop.dlq[0].headers.reason).toBe('missing-eventId-or-value');
        expect(loop.dlq[0].headers.attempts).toBe('1');
        expect(loop.dlq[0].headers.exceptionClass).toBe('MalformedMessage');
        expect(loop.store.size).toBe(0);
    });

    it('sends unparseable JSON straight to DLQ with the raw value', async () => {
        const loop = new TestableConsumerLoop(DEFAULT_RETRY_POLICY);
        const p = {
            topic: TOPIC,
            partition: 0,
            message: {
                key: null,
                value: Buffer.from('not-json'),
                headers: {eventId: Buffer.from('55555555-5555-5555-5555-555555555555')},
            },
        } as unknown as EachMessagePayload;

        await loop.handleMessage(TOPIC, p);

        expect(loop.dlq).toHaveLength(1);
        expect(loop.dlq[0].headers.reason).toBe('unparseable-json');
        expect(loop.dlq[0].value).toBe('not-json');
        expect(loop.store.size).toBe(1); // eventId was claimed before the parse failed
    });

    it('rethrows dedup-store failures that are not dedup hits (store down ≠ poison)', async () => {
        const loop = new TestableConsumerLoop(DEFAULT_RETRY_POLICY);
        const storeError = new Error('connection refused') as Error & {code?: string};
        // No code — a real store failure, not the P2002 unique violation.
        (loop as unknown as {prisma: {processedEvent: {create: () => Promise<never>}}}).prisma = {
            processedEvent: {create: () => Promise.reject(storeError)},
        };
        const event = {...VALID_EVENT, eventId: '66666666-6666-6666-6666-666666666666'};

        await expect(loop.handleMessage(TOPIC, payload(event.eventId, event))).rejects.toThrow('connection refused');
        expect(loop.dlq).toHaveLength(0);
    });
});
