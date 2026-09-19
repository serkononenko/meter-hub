import {ServiceUnavailableException} from "@nestjs/common";


export class MeterServiceUnavailableException extends ServiceUnavailableException {
    constructor(cause?: unknown) {
        super({
            code: 'METER_SERVICE_UNAVAILABLE',
            title: 'Meter service unavailable',
            detail: 'Meter ownership could not be verified; try again later.',
        }, {cause});
    }
}
