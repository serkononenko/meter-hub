import type {SubmissionRule} from './submission-rule.js';


// jsonb does not preserve key order, so a rule read back from the database cannot be compared
// by plain stringification.
export function sameRule(a: SubmissionRule, b: SubmissionRule): boolean {
    return stable(a) === stable(b);
}

function stable(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(stable).join(',')}]`;
    }

    if (value !== null && typeof value === 'object') {
        return `{${Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .sort(([x], [y]) => x.localeCompare(y))
            .map(([key, v]) => `${JSON.stringify(key)}:${stable(v)}`)
            .join(',')}}`;
    }

    return JSON.stringify(value);
}
