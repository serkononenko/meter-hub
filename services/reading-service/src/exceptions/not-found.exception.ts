import {NotFoundException} from "@nestjs/common";


export class MeterNotFoundException extends NotFoundException {
    constructor(meterId: string) {
        super({
            code: 'METER_NOT_FOUND',
            title: 'Meter not found',
            detail: `No meter with the identifier ${meterId} is visible to the authenticated user.`,
        });
    }
}
