import {NotImplementedException} from "@nestjs/common";


export class NotYetImplementedException extends NotImplementedException {
    constructor() {
        super({
            code: 'NOT_IMPLEMENTED',
            title: 'Not implemented',
            detail: 'This endpoint is not available yet.',
        });
    }
}
