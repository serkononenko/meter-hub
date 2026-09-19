import {BadRequestException} from "@nestjs/common";

import type {ValidationError} from "class-validator";


export class RequestValidationException extends BadRequestException {
    constructor(public readonly validationErrors: ValidationError[]) {
        super();
    }
}
