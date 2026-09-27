import {ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments} from "class-validator";

import {RecordedAtInFutureException, RecordedAtTooOldException} from "../exceptions/reading-argument.exception.js";


abstract class DateWindowConstraint implements ValidatorConstraintInterface {
    async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
        if (typeof value !== 'string') {
            return true; // Format is IsDateString's job, not ours.
        }

        this.assertPlausible(value, args);

        return true;
    }

    protected abstract assertPlausible(value: string, args: ValidationArguments): void;
}

@ValidatorConstraint({name: 'dateNotInFuture'})
export class DateNotInFutureConstraint extends DateWindowConstraint {
    protected assertPlausible(value: string): void {
        if (new Date(value).getTime() > Date.now()) {
            throw new RecordedAtInFutureException(value);
        }
    }
}

@ValidatorConstraint({name: 'dateNotOlderThan'})
export class DateNotOlderThanConstraint extends DateWindowConstraint {
    protected assertPlausible(value: string, args: ValidationArguments): void {
        const [maxAgeYears] = args.constraints as [number];
        const maxAgeMs = maxAgeYears * 365.25 * 24 * 60 * 60 * 1000;

        if (new Date(value).getTime() < Date.now() - maxAgeMs) {
            throw new RecordedAtTooOldException(value, maxAgeYears);
        }
    }
}
