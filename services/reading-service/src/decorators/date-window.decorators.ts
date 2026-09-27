import {Validate, ValidationOptions} from "class-validator";

import {DateNotInFutureConstraint, DateNotOlderThanConstraint} from "../validation/date-window.constraints.js";


export function DateNotInFuture(validationOptions?: ValidationOptions): PropertyDecorator {
    return Validate(DateNotInFutureConstraint, validationOptions);
}

export function DateNotOlderThan(maxAgeYears: number, validationOptions?: ValidationOptions): PropertyDecorator {
    return Validate(DateNotOlderThanConstraint, [maxAgeYears], validationOptions);
}
