import {ServiceUnavailableException} from "@nestjs/common";


export class HouseholdServiceUnavailableException extends ServiceUnavailableException {
    constructor(cause?: unknown) {
        super({
            code: 'HOUSEHOLD_SERVICE_UNAVAILABLE',
            title: 'Household service unavailable',
            detail: 'Household membership could not be verified; try again later.',
        }, {cause});
    }
}

export class MeterServiceUnavailableException extends ServiceUnavailableException {
    constructor(cause?: unknown) {
        super({
            code: 'METER_SERVICE_UNAVAILABLE',
            title: 'Meter service unavailable',
            detail: 'Meter ownership could not be verified; try again later.',
        }, {cause});
    }
}
