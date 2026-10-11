import {NotFoundException} from "@nestjs/common";


export class HouseholdNotFoundException extends NotFoundException {
    constructor(householdId: string) {
        super({
            code: 'HOUSEHOLD_NOT_FOUND',
            title: 'Household not found',
            detail: `No household with the identifier ${householdId} is visible to the authenticated user.`,
        });
    }
}

export class MeterNotFoundException extends NotFoundException {
    constructor() {
        super({
            code: 'METER_NOT_FOUND',
            title: 'Meter not found',
            detail: 'No meter with this identifier is visible to the authenticated user.',
        });
    }
}

export class ProviderNotFoundException extends NotFoundException {
    constructor() {
        super({
            code: 'PROVIDER_NOT_FOUND',
            title: 'Provider not found',
            detail: 'No provider with this identifier is visible to the authenticated user.',
        });
    }
}

export class ProviderAccountNotFoundException extends NotFoundException {
    constructor() {
        super({
            code: 'PROVIDER_ACCOUNT_NOT_FOUND',
            title: 'Provider account not found',
            detail: 'No provider account with this identifier is visible to the authenticated user.',
        });
    }
}

export class MeterBindingNotFoundException extends NotFoundException {
    constructor() {
        super({
            code: 'METER_BINDING_NOT_FOUND',
            title: 'Meter binding not found',
            detail: 'No meter binding with this identifier is visible to the authenticated user.',
        });
    }
}
