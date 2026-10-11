import {validate} from 'class-validator';
import {RequestValidationException} from "../exceptions/request-validation.exception.js";


export async function validateCommand(command: object): Promise<void> {
    const errors = await validate(command);

    if (errors.length > 0) {
        throw new RequestValidationException(errors);
    }
}
