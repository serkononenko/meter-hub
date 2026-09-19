import {ConflictException} from "@nestjs/common";


export class MeterSerialNumberConflictException extends ConflictException {
    constructor(serialNumber: string) {
        super({
            code: 'METER_SERIAL_NUMBER_CONFLICT',
            title: 'Meter serial number already registered',
            detail: `A meter with the serial number ${serialNumber} is already registered in this household.`,
        });
    }
}
