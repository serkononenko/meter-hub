import {addDays, addMonths, localCycleMonth, resolveDay, startOfLocalDay} from './calendar.js';

import type {CycleMonth, SubmissionRule, SubmissionWindow} from './submission-rule.js';


/** Expects a rule that passed validateSubmissionRule. */
export function windowFor(rule: SubmissionRule, cycle: CycleMonth): SubmissionWindow {
    const openDay = resolveDay(rule.opens, cycle);

    let closeCycle = cycle;
    let closeDay = resolveDay(rule.closes, closeCycle);

    if (closeDay < openDay) {
        closeCycle = addMonths(cycle, 1);
        closeDay = resolveDay(rule.closes, closeCycle);
    }

    const lastDay = {...closeCycle, day: closeDay};

    return {
        opensAt: startOfLocalDay({...cycle, day: openDay}, rule.timezone),
        closesAt: startOfLocalDay(addDays(lastDay, 1), rule.timezone),
    };
}

export function currentAndNext(
    rule: SubmissionRule,
    at: Date,
): { current: SubmissionWindow | null; next: SubmissionWindow } {
    const here = localCycleMonth(at, rule.timezone);
    const windows = [-1, 0, 1].map((offset) => windowFor(rule, addMonths(here, offset)));

    const current = windows.find((window) => window.opensAt <= at && at < window.closesAt) ?? null;
    const next = windows.find((window) => window.opensAt > at);

    if (!next) {
        throw new Error('No upcoming submission window found; the rule is not valid');
    }

    return {current, next};
}
