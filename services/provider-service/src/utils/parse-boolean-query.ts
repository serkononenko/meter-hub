import {RequestValidationException} from "../exceptions/request-validation.exception.js";


// The generated controllers only default a missing boolean query parameter; the value that
// arrives from a real query string is the text "true"/"false", not a boolean.
export function parseBooleanQuery(value: unknown): boolean {
    if (value === undefined || value === false || value === 'false') {
        return false;
    }

    if (value === true || value === 'true') {
        return true;
    }

    throw new RequestValidationException([]);
}
