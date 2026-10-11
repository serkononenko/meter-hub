import {describe, expect, it} from 'vitest';
import {validateSubmissionRule} from './submission-rule.validator.js';


const valid = {
    cycle: 'MONTHLY',
    opens: {kind: 'DAY_OF_MONTH', day: 20},
    closes: {kind: 'LAST_DAY', offsetDays: 0},
    timezone: 'Europe/Kyiv',
};

function problemsOf(input: unknown): string[] {
    const result = validateSubmissionRule(input);
    return 'problems' in result ? result.problems : [];
}

describe('validateSubmissionRule', () => {
    it('accepts a well-formed rule and returns it normalised', () => {
        const result = validateSubmissionRule({
            ...valid,
            closes: {kind: 'LAST_DAY'},
        });

        expect(result).toEqual({rule: {...valid, closes: {kind: 'LAST_DAY', offsetDays: 0}}});
    });

    it('accepts a window that wraps into the next month', () => {
        const wrapping = {...valid, opens: {kind: 'DAY_OF_MONTH', day: 25}, closes: {kind: 'DAY_OF_MONTH', day: 5}};

        expect(problemsOf(wrapping)).toEqual([]);
    });

    it('accepts a single-day window', () => {
        const single = {...valid, opens: {kind: 'DAY_OF_MONTH', day: 15}, closes: {kind: 'DAY_OF_MONTH', day: 15}};

        expect(problemsOf(single)).toEqual([]);
    });

    it.each([
        ['null', null],
        ['an array', []],
        ['a string', 'monthly'],
    ])('rejects %s', (_name, input) => {
        expect(problemsOf(input)).toEqual(['The rule must be an object.']);
    });

    it('rejects an unsupported cycle', () => {
        expect(problemsOf({...valid, cycle: 'YEARLY'})).toContain('cycle must be MONTHLY.');
    });

    it.each(['Mars/Phobos', '', '+03:00', 'not a zone'])('rejects the time zone "%s"', (timezone) => {
        expect(problemsOf({...valid, timezone})).toContain(
            'timezone must be an IANA time zone name such as Europe/Kyiv.',
        );
    });

    it('rejects a missing or non-string time zone', () => {
        expect(problemsOf({...valid, timezone: undefined})).toHaveLength(1);
        expect(problemsOf({...valid, timezone: 3})).toHaveLength(1);
    });

    it.each([0, 32, -1, 1.5, '20'])('rejects an opening day of %s', (day) => {
        expect(problemsOf({...valid, opens: {kind: 'DAY_OF_MONTH', day}})).toContain(
            'opens.day must be an integer from 1 to 31.',
        );
    });

    it('rejects a DAY_OF_MONTH spec with no day', () => {
        expect(problemsOf({...valid, closes: {kind: 'DAY_OF_MONTH'}})).toContain(
            'closes.day must be an integer from 1 to 31.',
        );
    });

    it.each([-1, 28, 2.5])('rejects a LAST_DAY offset of %s', (offsetDays) => {
        expect(problemsOf({...valid, closes: {kind: 'LAST_DAY', offsetDays}})).toContain(
            'closes.offsetDays must be an integer from 0 to 27.',
        );
    });

    it('rejects an unknown day kind and a missing day spec', () => {
        expect(problemsOf({...valid, opens: {kind: 'WEEKDAY'}})).toContain(
            'opens.kind must be DAY_OF_MONTH or LAST_DAY.',
        );
        expect(problemsOf({...valid, closes: undefined})).toContain('closes must be an object.');
    });

    it('reports every independent problem at once', () => {
        const problems = problemsOf({cycle: 'YEARLY', opens: {kind: 'DAY_OF_MONTH', day: 99}, closes: {}, timezone: 'x/y'});

        expect(problems).toHaveLength(4);
    });

    it('rejects a window that runs right up to the next cycle and is never closed', () => {
        const alwaysOpen = {...valid, opens: {kind: 'DAY_OF_MONTH', day: 5}, closes: {kind: 'DAY_OF_MONTH', day: 4}};

        expect(problemsOf(alwaysOpen)).toEqual([expect.stringContaining('leaves no gap before')]);
    });

    it('rejects a window that spans the whole month', () => {
        const wholeMonth = {...valid, opens: {kind: 'DAY_OF_MONTH', day: 1}, closes: {kind: 'LAST_DAY'}};

        expect(problemsOf(wholeMonth)).toEqual([expect.stringContaining('leaves no gap before')]);
    });

    it('rejects a window that only overlaps the next one in short months', () => {
        const clampedOverlap = {...valid, opens: {kind: 'DAY_OF_MONTH', day: 31}, closes: {kind: 'DAY_OF_MONTH', day: 30}};

        expect(problemsOf(clampedOverlap)).toEqual([expect.stringContaining('leaves no gap before')]);
    });
});
