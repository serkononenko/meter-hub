import {isUUID} from "class-validator";
import {RequestValidationException} from "../exceptions/request-validation.exception.js";


export function requireUuid(value: string | undefined, field: string): string {
    if (value === undefined || !isUUID(value)) {
        throw new RequestValidationException([{
            property: field,
            constraints: {isUuid: `${field} must be a UUID`},
        }]);
    }

    return value;
}

export function optionalUuid(value: string | undefined, field: string): string | undefined {
    return value === undefined ? undefined : requireUuid(value, field);
}
