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

export class ReadingNotFoundException extends NotFoundException {
    constructor(meterId: string) {
        super({
            code: 'READING_NOT_FOUND',
            title: 'Reading not found',
            detail: `The meter ${meterId} has no readings yet.`,
        });
    }
}
