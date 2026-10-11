import {Transform} from "class-transformer";
import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    isUUID,
    MaxLength,
    Validate,
    ValidatorConstraint,
} from "class-validator";

import {ProviderScope} from "../../generated/provider/models/index.js";

import type {ValidationArguments, ValidatorConstraintInterface} from "class-validator";
import type {CreateProviderRequest, SubmissionRule} from "../../generated/provider/models/index.js";


@ValidatorConstraint({name: 'householdIdMatchesScope'})
class HouseholdIdMatchesScope implements ValidatorConstraintInterface {
    validate(householdId: unknown, args: ValidationArguments): boolean {
        const {scope} = args.object as CreateProviderCommand;

        if (scope === ProviderScope.HOUSEHOLD) {
            return typeof householdId === 'string' && isUUID(householdId);
        }

        return householdId === undefined || householdId === null;
    }

    defaultMessage(args: ValidationArguments): string {
        const {scope} = args.object as CreateProviderCommand;

        return scope === ProviderScope.HOUSEHOLD
            ? 'householdId must be a UUID for HOUSEHOLD providers'
            : 'householdId must not be set for GLOBAL providers';
    }
}

export class CreateProviderCommand implements CreateProviderRequest {
    @IsEnum(ProviderScope)
    scope: ProviderScope;

    @Validate(HouseholdIdMatchesScope)
    householdId?: string;

    @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;

    defaultRule?: SubmissionRule;
}
