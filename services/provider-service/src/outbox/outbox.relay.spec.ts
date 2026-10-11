import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ConfigService} from '@nestjs/config';
import {EventEmitter2} from '@nestjs/event-emitter';
import {KafkaProducerService} from '../events/kafka-producer.service.js';
import {OutboxRelay} from './outbox.relay.js';
import {OutboxRepository, type OutboxEntry} from './outbox.repository.js';
import {
    OUTBOX_BATCH_PUBLISHED,
    OUTBOX_PUBLISH_FAILED,
    OUTBOX_ROUND_COMPLETED,
    OUTBOX_ROUND_FAILED,
} from './outbox.events.js';
import {ACCOUNT_CHANGED_TOPIC, BINDING_CHANGED_TOPIC} from './provider-events.js';

function accountEntry(id: string, accountId: string): OutboxEntry {
    return {
        id,
        eventType: ACCOUNT_CHANGED_TOPIC,
        aggregateKey: accountId,
        payload: {
            eventId: id,
            eventType: ACCOUNT_CHANGED_TOPIC,
            eventVersion: 1,
            occurredAt: '2026-10-11T12:00:00Z',
            producer: 'provider-service',
            data: {
                accountId,
                providerId: 'p1',
                householdId: 'h1',
                version: 1,
                rule: {cycle: 'MONTHLY', opens: {kind: 'DAY_OF_MONTH', day: 20}, closes: {kind: 'LAST_DAY'}, timezone: 'UTC'},
                archived: false,
            },
        },
        traceparent: null,
        createdAt: new Date('2026-10-11T12:00:00Z'),
    };
}

function bindingEntry(id: string, meterId: string): OutboxEntry {
    return {
        id,
        eventType: BINDING_CHANGED_TOPIC,
        aggregateKey: meterId,
        payload: {
            eventId: id,
            eventType: BINDING_CHANGED_TOPIC,
            eventVersion: 1,
            occurredAt: '2026-10-11T12:00:00Z',
            producer: 'provider-service',
            data: {
                bindingId: 'b1',
                accountId: 'a1',
                householdId: 'h1',
                meterId,
                validFrom: '2026-10-01',
                validTo: null,
                version: 1,
            },
        },
        traceparent: null,
        createdAt: new Date('2026-10-11T12:00:01Z'),
    };
}

function stubs() {
    const outbox = {
        findUnpublished: vi.fn().mockResolvedValue([]),
        markPublished: vi.fn().mockResolvedValue(undefined),
        countUnpublished: vi.fn().mockResolvedValue(0),
    };
    const producer = {send: vi.fn().mockResolvedValue(undefined)};
    const events = new EventEmitter2();
    const emitted: Array<{ name: string; payload: unknown }> = [];
    vi.spyOn(events, 'emit').mockImplementation(((name: string | symbol, ...values: unknown[]) => {
        emitted.push({name: String(name), payload: values[0]});
        return true;
    }) as typeof events.emit);
    return {outbox, producer, events, emitted};
}

function relayWith(s: ReturnType<typeof stubs>, relayEnabled = true) {
    return new OutboxRelay(
        s.outbox as unknown as OutboxRepository,
        s.producer as unknown as KafkaProducerService,
        s.events,
        {get: () => relayEnabled} as unknown as ConfigService,
    );
}

describe('OutboxRelay', () => {
    let s: ReturnType<typeof stubs>;

    beforeEach(() => {
        s = stubs();
    });

    it('publishes each event to the topic named by its type, keyed by its aggregate, in order', async () => {
        const account = accountEntry('a1', 'account-1');
        const binding = bindingEntry('b2', 'meter-1');
        s.outbox.findUnpublished.mockResolvedValue([account, binding]);

        await relayWith(s).relayRound();

        expect(s.producer.send).toHaveBeenNthCalledWith(1, ACCOUNT_CHANGED_TOPIC, 'account-1', account.payload, null);
        expect(s.producer.send).toHaveBeenNthCalledWith(2, BINDING_CHANGED_TOPIC, 'meter-1', binding.payload, null);
        expect(s.outbox.markPublished).toHaveBeenCalledWith(['a1', 'b2']);
        expect(s.emitted).toContainEqual({name: OUTBOX_BATCH_PUBLISHED, payload: {count: 2}});
    });

    it('passes the stored traceparent to the producer', async () => {
        const withTrace = {...accountEntry('a1', 'account-1'), traceparent: '00-abc-def-01'};
        s.outbox.findUnpublished.mockResolvedValue([withTrace]);

        await relayWith(s).relayRound();

        expect(s.producer.send).toHaveBeenCalledWith(ACCOUNT_CHANGED_TOPIC, 'account-1', withTrace.payload, '00-abc-def-01');
    });

    it('stops at the first failed publish and marks only what was produced', async () => {
        s.outbox.findUnpublished.mockResolvedValue([accountEntry('a1', 'account-1'), accountEntry('b2', 'account-1')]);
        s.producer.send.mockRejectedValueOnce(new Error('broker down'));

        await relayWith(s).relayRound();

        expect(s.producer.send).toHaveBeenCalledTimes(1);
        expect(s.outbox.markPublished).not.toHaveBeenCalled();
        expect(s.emitted).toContainEqual({name: OUTBOX_PUBLISH_FAILED, payload: {eventId: 'a1'}});
    });

    it('marks the events produced before a failure', async () => {
        s.outbox.findUnpublished.mockResolvedValue([accountEntry('a1', 'account-1'), accountEntry('b2', 'account-1')]);
        s.producer.send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('broker down'));

        await relayWith(s).relayRound();

        expect(s.outbox.markPublished).toHaveBeenCalledWith(['a1']);
    });

    it('keeps the event unpublished when marking fails and republishes it next round (at-least-once)', async () => {
        s.outbox.findUnpublished.mockResolvedValue([accountEntry('a1', 'account-1')]);
        s.outbox.markPublished.mockRejectedValueOnce(new Error('db down'));
        const relay = relayWith(s);

        await relay.relayRound();
        expect(s.emitted).toContainEqual({name: OUTBOX_ROUND_FAILED, payload: {reason: 'db down'}});

        await relay.relayRound();
        expect(s.producer.send).toHaveBeenCalledTimes(2);
        expect(s.outbox.markPublished).toHaveBeenLastCalledWith(['a1']);
    });

    it('announces a failed round, not a completed one, when the round crashes', async () => {
        s.outbox.findUnpublished.mockRejectedValue(new Error('db down'));

        await relayWith(s).relayRound();

        expect(s.emitted).toContainEqual({name: OUTBOX_ROUND_FAILED, payload: {reason: 'db down'}});
        expect(s.emitted.filter((e) => e.name === OUTBOX_ROUND_COMPLETED)).toHaveLength(0);
    });

    it('does nothing but report the backlog when the outbox is empty', async () => {
        await relayWith(s).relayRound();

        expect(s.producer.send).not.toHaveBeenCalled();
        expect(s.outbox.markPublished).not.toHaveBeenCalled();
        expect(s.emitted).toContainEqual({name: OUTBOX_ROUND_COMPLETED, payload: {backlog: 0}});
    });

    it('does not poll when the relay is switched off, but still runs an explicit round', async () => {
        s.outbox.findUnpublished.mockResolvedValue([accountEntry('a1', 'account-1')]);
        const relay = relayWith(s, false);

        await relay.tick();
        expect(s.producer.send).not.toHaveBeenCalled();

        await relay.relayRound();
        expect(s.producer.send).toHaveBeenCalledTimes(1);
    });

    it('polls on the timer when the relay is on', async () => {
        s.outbox.findUnpublished.mockResolvedValue([accountEntry('a1', 'account-1')]);

        await relayWith(s).tick();

        expect(s.producer.send).toHaveBeenCalledTimes(1);
    });

    it('skips a round that overlaps one still running', async () => {
        let release: () => void = () => undefined;
        s.outbox.findUnpublished.mockReturnValue(new Promise((resolve) => {
            release = () => resolve([]);
        }));
        const relay = relayWith(s);

        const first = relay.relayRound();
        await relay.relayRound();
        release();
        await first;

        expect(s.outbox.findUnpublished).toHaveBeenCalledTimes(1);
    });
});
