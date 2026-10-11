import {ConflictException, NotImplementedException, UnprocessableEntityException} from "@nestjs/common";


export class InvalidSubmissionRuleException extends UnprocessableEntityException {
    constructor(problems: string[]) {
        super({
            code: 'INVALID_SUBMISSION_RULE',
            title: 'Invalid submission rule',
            detail: problems.join(' '),
        });
    }
}

export class ProviderAlreadyGlobalException extends ConflictException {
    constructor() {
        super({
            code: 'PROVIDER_ALREADY_GLOBAL',
            title: 'Provider already global',
            detail: 'The provider is already part of the global catalog.',
        });
    }
}

export class NotYetImplementedException extends NotImplementedException {
    constructor() {
        super({
            code: 'NOT_IMPLEMENTED',
            title: 'Not implemented',
            detail: 'This endpoint is not available yet.',
        });
    }
}
