import {ForbiddenException} from "@nestjs/common";


export class HouseholdAccessException extends ForbiddenException {
    constructor(householdId: string, cause?: unknown) {
        super(`Access to household ${householdId} is forbidden`, {cause});
    }
}
