import {registerDecorator, ValidatorConstraint} from 'class-validator';

import type {ValidationArguments, ValidationOptions, ValidatorConstraintInterface} from 'class-validator';


/** Synthetic field the failure is reported under in validation problems. */
const FIELD = 'body';

/**
 * Class-level rule standing in for the contract's `minProperties: 1` on
 * update requests: at least one known field must be present in the payload.
 * Anchored to a synthetic property so the rendered problem carries
 * `field: "body"` even for an empty object.
 */
export function AtLeastOneField(validationOptions?: ValidationOptions): ClassDecorator {
    return (target: Function): void => {
        registerDecorator({
            name: 'atLeastOneField',
            target,
            propertyName: FIELD,
            validator: AtLeastOneFieldConstraint,
            options: validationOptions,
        });
    };
}

@ValidatorConstraint({name: 'atLeastOneField'})
class AtLeastOneFieldConstraint implements ValidatorConstraintInterface {
    validate(_value: unknown, args: ValidationArguments): boolean {
        return Object.values(args.object).some((value) => value !== undefined);
    }

    defaultMessage(): string {
        return 'at least one field must be provided';
    }
}
