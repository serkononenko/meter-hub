import {describe, expect, it, vi, beforeEach} from 'vitest';
import {EventEmitter2} from '@nestjs/event-emitter';
import {OutboxRelay} from './outbox.relay.js';
import {OutboxRepository, type OutboxEntry} from './outbox.repository.js';
import {KafkaProducerService} from '../events/kafka-producer.service.js';
import {
    OUTBOX_BATCH_PUBLISHED,
    OUTBOX_PUBLISH_FAILED,
    OUTBOX_ROUND_COMPLETED,
    OUTBOX_ROUND_FAILED,
} from './outbox.events.js';

const READING_CREATED_TOPIC = 'meter.reading.created';

function entry(id: string, meterId: string): OutboxEntry {
    return {
        id,
        eventType: READING_CREATED_TOPIC,
        payload: {
            eventId: id,
            eventType: READING_CREATED_TOPIC,
            eventVersion: 1,
            occurredAt: '2026-10-02T12:00:00Z',
            producer: 'reading-service',
            data: {
                readingId: id,
                meterId,
                value: 100,
                unit: 'KWH',
                recordedAt: '2026-10-02T11:59:59Z',
                source: 'MANUAL',
            },
        },
        traceparent: null,
        createdAt: new Date('2026-10-02T12:00:00Z'),
    };
}

function stubs() {
    const outbox = {
        findUnpublished: vi.fn().mockResolvedValue([]),
        markPublished: vi.fn().mockResolvedValue(undefined),
        countUnpublished: vi.fn().mockResolvedValue(0),
    };
    const producer = {
        send: vi.fn().mockResolvedValue(undefined),
    };
    // Real event bus, fresh per stub set; the emit spy records what the
    // relay announces — asserting on domain events is exactly the seam
    // the event-emitter design opens up (metrics listener not needed).
    const events = new EventEmitter2();
    const emitted: Array<{name: string; payload: unknown}> = [];
    vi.spyOn(events, 'emit').mockImplementation(((name: string | symbol, ...values: unknown[]) => {
        emitted.push({name: String(name), payload: values[0]});
        return true;
    }) as typeof events.emit);
    return {outbox, producer, events, emitted};
}

function relayWith(s: ReturnType<typeof stubs>) {
    return new OutboxRelay(
        s.outbox as unknown as OutboxRepository,
        s.producer as unknown as KafkaProducerService,
        s.events,
    );
}

describe('OutboxRelay', () => {
    let s: ReturnType<typeof stubs>;

    beforeEach(() => {
        s = stubs();
    });

    it('publishes unpublished events in FIFO order and marks them', async () => {
        const first = entry('a1', 'meter-1');
        const second = entry('b2', 'meter-1');
        s.outbox.findUnpublished.mockResolvedValue([first, second]);

        await relayWith(s).relayRound();

        expect(s.producer.send).toHaveBeenCalledTimes(2);
        expect(s.producer.send).toHaveBeenNthCalledWith(
            1, READING_CREATED_TOPIC, 'meter-1', first.payload, null,
        );
        expect(s.producer.send).toHaveBeenNthCalledWith(
            2, READING_CREATED_TOPIC, 'meter-1', second.payload, null,
        );
        expect(s.outbox.markPublished).toHaveBeenCalledWith(['a1', 'b2']);
        expect(s.emitted).toContainEqual({name: OUTBOX_BATCH_PUBLISHED, payload: {count: 2}});
    });

    it('passes the stored traceparent to the producer', async () => {
        const withTrace = {...entry('a1', 'meter-1'), traceparent: '00-abc-def-01'};
        s.outbox.findUnpublished.mockResolvedValue([withTrace]);

        await relayWith(s).relayRound();

        expect(s.producer.send).toHaveBeenCalledWith(
            READING_CREATED_TOPIC, 'meter-1', withTrace.payload, '00-abc-def-01',
        );
    });

    it('stops at the first failed publish and marks only what was produced', async () => {
        const first = entry('a1', 'meter-1');
        const second = entry('b2', 'meter-1');
        s.outbox.findUnpublished.mockResolvedValue([first, second]);
        s.producer.send.mockRejectedValueOnce(new Error('broker down'));

        await relayWith(s).relayRound();

        // a1 failed → b2 stays queued for the next round (FIFO preserved)
        expect(s.producer.send).toHaveBeenCalledTimes(1);
        expect(s.outbox.markPublished).not.toHaveBeenCalled();
        expect(s.emitted).toContainEqual({name: OUTBOX_PUBLISH_FAILED, payload: {eventId: 'a1'}});
    });

    it('keeps the event unpublished when marking fails (at-least-once)', async () => {
        const only = entry('a1', 'meter-1');
        s.outbox.findUnpublished.mockResolvedValue([only]);
        s.outbox.markPublished.mockRejectedValueOnce(new Error('db down'));

        const relay = relayWith(s);
        // The round swallows the failure (the scheduled loop must not
        // reject) — the event stays unpublished and is produced again
        // next round; consumers dedup on eventId.
        await relay.relayRound();
        expect(s.producer.send).toHaveBeenCalledTimes(1);
        expect(s.emitted).toContainEqual({name: OUTBOX_ROUND_FAILED, payload: {reason: 'db down'}});

        // a later round re-publishes and then marks
        await relay.relayRound();
        expect(s.producer.send).toHaveBeenCalledTimes(2);
        expect(s.outbox.markPublished).toHaveBeenCalledWith(['a1']);
    });

    it('announces round failure (not completion) when the round crashes', async () => {
        s.outbox.findUnpublished.mockRejectedValue(new Error('db down'));

        await relayWith(s).relayRound();

        expect(s.emitted).toContainEqual({name: OUTBOX_ROUND_FAILED, payload: {reason: 'db down'}});
        expect(s.emitted.filter((e) => e.name === OUTBOX_ROUND_COMPLETED)).toHaveLength(0);
    });

    it('does nothing when the outbox is empty', async () => {
        await relayWith(s).relayRound();

        expect(s.producer.send).not.toHaveBeenCalled();
        expect(s.outbox.markPublished).not.toHaveBeenCalled();
        expect(s.outbox.countUnpublished).toHaveBeenCalled();
        expect(s.emitted).toContainEqual({name: OUTBOX_ROUND_COMPLETED, payload: {backlog: 0}});
    });
});
