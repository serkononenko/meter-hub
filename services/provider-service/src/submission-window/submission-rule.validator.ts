import {addMonths, isKnownTimeZone} from './calendar.js';
import {windowFor} from './submission-window.js';

import type {CycleMonth, DaySpec, SubmissionRule} from './submission-rule.js';


export type RuleValidation = { rule: SubmissionRule } | { problems: string[] };

// 2024 is a leap year and 2025 is not, so the span covers every pair of adjacent month lengths.
const CHECKED_CYCLES: CycleMonth[] = Array.from({length: 24}, (_, index) => addMonths({year: 2024, month: 1}, index));

export function validateSubmissionRule(input: unknown): RuleValidation {
    if (!isRecord(input)) {
        return {problems: ['The rule must be an object.']};
    }

    const problems: string[] = [];

    if (input.cycle !== 'MONTHLY') {
        problems.push('cycle must be MONTHLY.');
    }

    const opens = daySpecProblems('opens', input.opens, problems);
    const closes = daySpecProblems('closes', input.closes, problems);

    const timezone = input.timezone;
    if (typeof timezone !== 'string' || !isKnownTimeZone(timezone)) {
        problems.push('timezone must be an IANA time zone name such as Europe/Kyiv.');
    }

    if (problems.length > 0 || !opens || !closes || typeof timezone !== 'string') {
        return {problems};
    }

    const rule: SubmissionRule = {cycle: 'MONTHLY', opens, closes, timezone};
    const overlap = findOverlap(rule);

    return overlap ? {problems: [overlap]} : {rule};
}

function findOverlap(rule: SubmissionRule): string | null {
    for (let index = 0; index + 1 < CHECKED_CYCLES.length; index++) {
        const [current, following] = [CHECKED_CYCLES[index], CHECKED_CYCLES[index + 1]];

        if (windowFor(rule, current).closesAt >= windowFor(rule, following).opensAt) {
            return `The window of ${label(current)} leaves no gap before the window of ${label(following)}.`;
        }
    }

    return null;
}

function label({year, month}: CycleMonth): string {
    return `${year}-${String(month).padStart(2, '0')}`;
}

function daySpecProblems(name: string, value: unknown, problems: string[]): DaySpec | null {
    if (!isRecord(value)) {
        problems.push(`${name} must be an object.`);
        return null;
    }

    if (value.kind === 'DAY_OF_MONTH') {
        if (!isIntegerBetween(value.day, 1, 31)) {
            problems.push(`${name}.day must be an integer from 1 to 31.`);
            return null;
        }
        return {kind: 'DAY_OF_MONTH', day: value.day};
    }

    if (value.kind === 'LAST_DAY') {
        const offsetDays = value.offsetDays ?? 0;
        if (!isIntegerBetween(offsetDays, 0, 27)) {
            problems.push(`${name}.offsetDays must be an integer from 0 to 27.`);
            return null;
        }
        return {kind: 'LAST_DAY', offsetDays};
    }

    problems.push(`${name}.kind must be DAY_OF_MONTH or LAST_DAY.`);
    return null;
}

function isIntegerBetween(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
