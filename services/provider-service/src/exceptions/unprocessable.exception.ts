import {ConflictException, UnprocessableEntityException} from "@nestjs/common";


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

export class HouseholdMismatchException extends UnprocessableEntityException {
    constructor() {
        super({
            code: 'HOUSEHOLD_MISMATCH',
            title: 'Household mismatch',
            detail: 'The meter belongs to a different household than the account.',
        });
    }
}

export class UnknownMeterReferenceException extends UnprocessableEntityException {
    constructor() {
        super({
            code: 'METER_NOT_FOUND',
            title: 'Meter not found',
            detail: 'No meter with this identifier exists in the account\'s household.',
        });
    }
}

export class InvalidBindingPeriodException extends UnprocessableEntityException {
    constructor(validFrom: string, validTo: string) {
        super({
            code: 'INVALID_BINDING_PERIOD',
            title: 'Invalid binding period',
            detail: `validTo ${validTo} precedes validFrom ${validFrom}.`,
        });
    }
}

export class MeterAlreadyBoundException extends ConflictException {
    constructor() {
        super({
            code: 'METER_ALREADY_BOUND',
            title: 'Meter already bound',
            detail: 'The meter already has a binding that overlaps the requested period.',
        });
    }
}

export class AccountHasActiveBindingsException extends ConflictException {
    constructor() {
        super({
            code: 'ACCOUNT_HAS_ACTIVE_BINDINGS',
            title: 'Account has active bindings',
            detail: 'The account still has open meter bindings; end them before archiving it.',
        });
    }
}

export class AccountArchivedException extends ConflictException {
    constructor() {
        super({
            code: 'ACCOUNT_ARCHIVED',
            title: 'Account archived',
            detail: 'The account is archived and cannot be bound to a meter.',
        });
    }
}

export class ProviderArchivedException extends ConflictException {
    constructor() {
        super({
            code: 'PROVIDER_ARCHIVED',
            title: 'Provider archived',
            detail: 'The provider is archived and cannot be chosen for an account.',
        });
    }
}

export class BindingAlreadyEndedException extends ConflictException {
    constructor() {
        super({
            code: 'BINDING_ALREADY_ENDED',
            title: 'Binding already ended',
            detail: 'The binding has already been ended.',
        });
    }
}
