import type {CycleMonth, DaySpec} from './submission-rule.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LocalDate extends CycleMonth {
    day: number;
}

export function daysInMonth({year, month}: CycleMonth): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonths({year, month}: CycleMonth, months: number): CycleMonth {
    const index = year * 12 + (month - 1) + months;
    return {year: Math.floor(index / 12), month: (index % 12) + 1};
}

export function addDays({year, month, day}: LocalDate, days: number): LocalDate {
    const shifted = new Date(Date.UTC(year, month - 1, day + days));
    return {year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate()};
}

export function resolveDay(spec: DaySpec, cycle: CycleMonth): number {
    const length = daysInMonth(cycle);

    if (spec.kind === 'LAST_DAY') {
        return length - (spec.offsetDays ?? 0);
    }

    return Math.min(spec.day ?? 1, length);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
    let formatter = formatters.get(timeZone);

    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        });
        formatters.set(timeZone, formatter);
    }

    return formatter;
}

function localParts(instantMs: number, timeZone: string): Record<string, number> {
    const parts: Record<string, number> = {};

    for (const part of formatterFor(timeZone).formatToParts(instantMs)) {
        if (part.type !== 'literal') {
            parts[part.type] = Number(part.value);
        }
    }

    return parts;
}

function offsetMs(instantMs: number, timeZone: string): number {
    const p = localParts(instantMs, timeZone);
    const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return local - Math.floor(instantMs / 1000) * 1000;
}

export function localCycleMonth(instant: Date, timeZone: string): CycleMonth {
    const {year, month} = localParts(instant.getTime(), timeZone);
    return {year, month};
}

export function localDateOf(instant: Date, timeZone: string): LocalDate {
    const {year, month, day} = localParts(instant.getTime(), timeZone);
    return {year, month, day};
}

export function isKnownTimeZone(timeZone: string): boolean {
    if (/^[+-]/.test(timeZone)) {
        return false;
    }

    try {
        formatterFor(timeZone);
        return true;
    } catch {
        return false;
    }
}

/**
 * First instant of the given local calendar day. An ambiguous midnight (clocks set back across it)
 * resolves to the earlier occurrence; a skipped midnight (clocks set forward across it) resolves
 * to the moment of the jump, which is the day's first real instant.
 */
export function startOfLocalDay({year, month, day}: LocalDate, timeZone: string): Date {
    const localMs = Date.UTC(year, month - 1, day);
    const offsetBefore = offsetMs(localMs - DAY_MS, timeZone);
    const offsetAfter = offsetMs(localMs + DAY_MS, timeZone);

    const candidates = [...new Set([offsetBefore, offsetAfter])]
        .map((offset) => localMs - offset)
        .filter((instant) => instant + offsetMs(instant, timeZone) === localMs);

    return new Date(candidates.length > 0 ? Math.min(...candidates) : localMs - offsetBefore);
}
