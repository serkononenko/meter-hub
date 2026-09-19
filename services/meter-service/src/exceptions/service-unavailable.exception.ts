import {ServiceUnavailableException} from "@nestjs/common";


export class HouseholdServiceUnavailableException extends ServiceUnavailableException {
    constructor(cause?: unknown) {
        super({
            code: 'HOUSEHOLD_SERVICE_UNAVAILABLE',
            title: 'Household service unavailable',
            detail: 'Household ownership could not be verified; try again later.',
        }, {cause});
    }
}