import {BadRequestException} from "@nestjs/common";


export class RequestValidationException extends BadRequestException {
    constructor() {
        super();
    }
}