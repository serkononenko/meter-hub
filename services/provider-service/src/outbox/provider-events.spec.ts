import {describe, expect, it} from 'vitest';
import {accountChanged, bindingChanged} from './provider-events.js';

const RULE = {cycle: 'MONTHLY', opens: {kind: 'DAY_OF_MONTH', day: 20}, closes: {kind: 'LAST_DAY', offsetDays: 0}, timezone: 'Europe/Kyiv'} as const;

describe('provider events', () => {
    it('snapshots the whole account, carrying its version and rule', () => {
        const event = accountChanged({
            id: 'acc', providerId: 'prov', householdId: 'hh', label: 'Electricity', accountNumber: '123',
            rule: RULE, version: 3, archived: true, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-11T08:00:00.000Z',
        });

        expect(event).toMatchObject({
            eventType: 'provider.account.changed',
            eventVersion: 1,
            producer: 'provider-service',
            occurredAt: '2026-10-11T08:00:00.000Z',
            data: {accountId: 'acc', providerId: 'prov', householdId: 'hh', version: 3, rule: RULE, archived: true},
        });
    });

    it('does not leak user-facing account fields into the event', () => {
        const event = accountChanged({
            id: 'acc', providerId: 'prov', householdId: 'hh', label: 'Electricity', accountNumber: '0012345678',
            rule: RULE, version: 1, archived: false, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
        });

        expect(JSON.stringify(event)).not.toContain('0012345678');
        expect(JSON.stringify(event)).not.toContain('Electricity');
    });

    it('snapshots a binding, with a null validTo while open-ended', () => {
        const open = bindingChanged({
            id: 'b', accountId: 'acc', householdId: 'hh', meterId: 'm', validFrom: '2026-10-01', validTo: null,
            version: 1, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
        });
        const ended = bindingChanged({
            id: 'b', accountId: 'acc', householdId: 'hh', meterId: 'm', validFrom: '2026-10-01', validTo: '2026-10-31',
            version: 2, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z',
        });

        expect(open.data).toEqual({bindingId: 'b', accountId: 'acc', householdId: 'hh', meterId: 'm', validFrom: '2026-10-01', validTo: null, version: 1});
        expect(ended.data).toMatchObject({validTo: '2026-10-31', version: 2});
        expect(open.eventType).toBe('provider.binding.changed');
    });

    it('gives every event its own id', () => {
        const binding = {
            id: 'b', accountId: 'acc', householdId: 'hh', meterId: 'm', validFrom: '2026-10-01', validTo: null,
            version: 1, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
        };

        expect(bindingChanged(binding).eventId).not.toBe(bindingChanged(binding).eventId);
    });
});
