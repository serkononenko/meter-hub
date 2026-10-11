import {addMonths, localCycleMonth} from '../submission-window/calendar.js';
import {windowFor} from '../submission-window/submission-window.js';

import type {SubmissionRule, SubmissionWindow} from '../submission-window/submission-rule.js';


// Windows can open a cycle before the range starts (wrapping windows), so one extra month is scanned on each side.
export function windowsOverlapping(rule: SubmissionRule, from: Date, to: Date): SubmissionWindow[] {
    const first = addMonths(localCycleMonth(from, rule.timezone), -1);
    const last = addMonths(localCycleMonth(to, rule.timezone), 1);

    const windows: SubmissionWindow[] = [];
    for (let cycle = first; cycle.year * 12 + cycle.month <= last.year * 12 + last.month; cycle = addMonths(cycle, 1)) {
        const window = windowFor(rule, cycle);

        if (window.opensAt < to && window.closesAt > from) {
            windows.push(window);
        }
    }

    return windows;
}
