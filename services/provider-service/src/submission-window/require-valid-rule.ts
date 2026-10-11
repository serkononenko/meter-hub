import {InvalidSubmissionRuleException} from "../exceptions/unprocessable.exception.js";
import {validateSubmissionRule} from "./submission-rule.validator.js";

import type {SubmissionRule} from "./submission-rule.js";


export function requireValidRule(input: unknown): SubmissionRule {
    const result = validateSubmissionRule(input);

    if ('problems' in result) {
        throw new InvalidSubmissionRuleException(result.problems);
    }

    return result.rule;
}
