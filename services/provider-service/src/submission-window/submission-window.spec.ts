import {describe, expect, it} from 'vitest';
import {currentAndNext, windowFor} from './submission-window.js';

import type {DaySpec, SubmissionRule} from './submission-rule.js';


const dayOfMonth = (day: number): DaySpec => ({kind: 'DAY_OF_MONTH', day});
const lastDay = (offsetDays = 0): DaySpec => ({kind: 'LAST_DAY', offsetDays});

function rule(opens: DaySpec, closes: DaySpec, timezone = 'UTC'): SubmissionRule {
    return {cycle: 'MONTHLY', opens, closes, timezone};
}

function iso(window: { opensAt: Date; closesAt: Date }) {
    return {opensAt: window.opensAt.toISOString(), closesAt: window.closesAt.toISOString()};
}

describe('windowFor', () => {
    it.each([
        ['31-day month', {year: 2026, month: 1}, '2026-01-20T00:00:00.000Z', '2026-02-01T00:00:00.000Z'],
        ['30-day month', {year: 2026, month: 4}, '2026-04-20T00:00:00.000Z', '2026-05-01T00:00:00.000Z'],
        ['non-leap February', {year: 2025, month: 2}, '2025-02-20T00:00:00.000Z', '2025-03-01T00:00:00.000Z'],
        ['leap February', {year: 2024, month: 2}, '2024-02-20T00:00:00.000Z', '2024-03-01T00:00:00.000Z'],
        ['December into the next year', {year: 2026, month: 12}, '2026-12-20T00:00:00.000Z', '2027-01-01T00:00:00.000Z'],
    ])('opens the 20th and closes on the last day: %s', (_name, cycle, opensAt, closesAt) => {
        expect(iso(windowFor(rule(dayOfMonth(20), lastDay()), cycle))).toEqual({opensAt, closesAt});
    });

    it('clamps a day beyond the end of the month to its last day', () => {
        const r = rule(dayOfMonth(31), lastDay());

        expect(windowFor(r, {year: 2025, month: 2}).opensAt.toISOString()).toBe('2025-02-28T00:00:00.000Z');
        expect(windowFor(r, {year: 2024, month: 2}).opensAt.toISOString()).toBe('2024-02-29T00:00:00.000Z');
        expect(windowFor(r, {year: 2026, month: 4}).opensAt.toISOString()).toBe('2026-04-30T00:00:00.000Z');
        expect(windowFor(r, {year: 2026, month: 1}).opensAt.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    });

    it('counts LAST_DAY offsets back from the end of the month', () => {
        const r = rule(lastDay(3), lastDay());

        expect(windowFor(r, {year: 2026, month: 1}).opensAt.toISOString()).toBe('2026-01-28T00:00:00.000Z');
        expect(windowFor(r, {year: 2025, month: 2}).opensAt.toISOString()).toBe('2025-02-25T00:00:00.000Z');
        expect(windowFor(r, {year: 2024, month: 2}).opensAt.toISOString()).toBe('2024-02-26T00:00:00.000Z');
    });

    it('treats the closing day as fully inside the window', () => {
        const window = windowFor(rule(dayOfMonth(10), dayOfMonth(12)), {year: 2026, month: 3});

        expect(window.closesAt.toISOString()).toBe('2026-03-13T00:00:00.000Z');
    });

    it('makes equal opening and closing days a single-day window', () => {
        const window = windowFor(rule(dayOfMonth(20), dayOfMonth(20)), {year: 2026, month: 3});

        expect(iso(window)).toEqual({opensAt: '2026-03-20T00:00:00.000Z', closesAt: '2026-03-21T00:00:00.000Z'});
    });

    it('closes in the next month when the closing day precedes the opening day', () => {
        const r = rule(dayOfMonth(25), dayOfMonth(5));

        expect(iso(windowFor(r, {year: 2026, month: 1}))).toEqual({
            opensAt: '2026-01-25T00:00:00.000Z',
            closesAt: '2026-02-06T00:00:00.000Z',
        });
        expect(windowFor(r, {year: 2026, month: 12}).closesAt.toISOString()).toBe('2027-01-06T00:00:00.000Z');
    });

    it('resolves a wrapping close against the month it lands in', () => {
        const r = rule(dayOfMonth(30), lastDay(2));

        expect(iso(windowFor(r, {year: 2026, month: 1}))).toEqual({
            opensAt: '2026-01-30T00:00:00.000Z',
            closesAt: '2026-02-27T00:00:00.000Z',
        });
    });

    describe('time zones', () => {
        const kyiv = rule(dayOfMonth(20), lastDay(), 'Europe/Kyiv');

        it('anchors both ends at local midnight, in winter time', () => {
            expect(iso(windowFor(kyiv, {year: 2026, month: 2}))).toEqual({
                opensAt: '2026-02-19T22:00:00.000Z',
                closesAt: '2026-02-28T22:00:00.000Z',
            });
        });

        it('uses each end its own offset when daylight saving changes inside the window', () => {
            expect(iso(windowFor(kyiv, {year: 2026, month: 10}))).toEqual({
                opensAt: '2026-10-19T21:00:00.000Z',
                closesAt: '2026-10-31T22:00:00.000Z',
            });
        });

        it('keeps the calendar day when the clocks change on the opening day itself', () => {
            const r = rule(dayOfMonth(29), lastDay(), 'Europe/Kyiv');

            expect(windowFor(r, {year: 2026, month: 3}).opensAt.toISOString()).toBe('2026-03-28T22:00:00.000Z');
        });

        it('starts a day whose midnight was skipped at the moment the clocks jumped', () => {
            const saoPaulo = rule(dayOfMonth(4), dayOfMonth(10), 'America/Sao_Paulo');

            expect(windowFor(saoPaulo, {year: 2018, month: 11}).opensAt.toISOString()).toBe('2018-11-04T03:00:00.000Z');
        });

        it('starts a day whose midnight happened twice at the first occurrence', () => {
            const havana = rule(dayOfMonth(2), dayOfMonth(10), 'America/Havana');

            expect(windowFor(havana, {year: 2025, month: 11}).opensAt.toISOString()).toBe('2025-11-02T04:00:00.000Z');
        });
    });
});

describe('currentAndNext', () => {
    const monthly = rule(dayOfMonth(20), lastDay());

    it('reports no current window between windows and the next one to open', () => {
        const result = currentAndNext(monthly, new Date('2026-03-10T12:00:00Z'));

        expect(result.current).toBeNull();
        expect(iso(result.next)).toEqual({opensAt: '2026-03-20T00:00:00.000Z', closesAt: '2026-04-01T00:00:00.000Z'});
    });

    it('is inside the window from the very instant it opens', () => {
        const result = currentAndNext(monthly, new Date('2026-03-20T00:00:00Z'));

        expect(iso(result.current!)).toEqual({opensAt: '2026-03-20T00:00:00.000Z', closesAt: '2026-04-01T00:00:00.000Z'});
        expect(result.next.opensAt.toISOString()).toBe('2026-04-20T00:00:00.000Z');
    });

    it('is still inside the window one millisecond before it closes', () => {
        const result = currentAndNext(monthly, new Date('2026-03-31T23:59:59.999Z'));

        expect(result.current).not.toBeNull();
    });

    it('is outside the window from the very instant it closes', () => {
        const result = currentAndNext(monthly, new Date('2026-04-01T00:00:00Z'));

        expect(result.current).toBeNull();
        expect(result.next.opensAt.toISOString()).toBe('2026-04-20T00:00:00.000Z');
    });

    it('finds a window that opened in the previous month and wraps over the boundary', () => {
        const wrapping = rule(dayOfMonth(25), dayOfMonth(5));

        const result = currentAndNext(wrapping, new Date('2026-02-02T08:00:00Z'));

        expect(iso(result.current!)).toEqual({opensAt: '2026-01-25T00:00:00.000Z', closesAt: '2026-02-06T00:00:00.000Z'});
        expect(result.next.opensAt.toISOString()).toBe('2026-02-25T00:00:00.000Z');
    });

    it('works out the cycle month in the rule\'s own time zone, not UTC', () => {
        const kyiv = rule(dayOfMonth(20), lastDay(), 'Europe/Kyiv');

        const result = currentAndNext(kyiv, new Date('2026-02-28T23:30:00Z'));

        expect(result.current).toBeNull();
        expect(result.next.opensAt.toISOString()).toBe('2026-03-19T22:00:00.000Z');
    });

    it('rolls over the year boundary for the next window', () => {
        const result = currentAndNext(monthly, new Date('2026-12-25T00:00:00Z'));

        expect(result.current).not.toBeNull();
        expect(result.next.opensAt.toISOString()).toBe('2027-01-20T00:00:00.000Z');
    });
});
