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
    constructor(meterId: string) {
        super({
            code: 'METER_NOT_FOUND',
            title: 'Meter not found',
            detail: `No meter with the identifier ${meterId} is visible to the authenticated user.`,
        });
    }
}