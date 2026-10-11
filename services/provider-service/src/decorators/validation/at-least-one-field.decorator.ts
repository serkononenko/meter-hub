import {registerDecorator, ValidatorConstraint} from 'class-validator';

import type {ValidationArguments, ValidationOptions, ValidatorConstraintInterface} from 'class-validator';


// Anchored to a synthetic property so the problem carries `field: "body"` even for an empty object.
const FIELD = 'body';

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
