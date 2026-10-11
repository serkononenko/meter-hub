import {Transform} from "class-transformer";
import {IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength} from "class-validator";

import {AtLeastOneField} from "../../decorators/validation/at-least-one-field.decorator.js";

import type {SubmissionRule, UpdateProviderRequest} from "../../generated/provider/models/index.js";


@AtLeastOneField()
export class UpdateProviderCommand implements UpdateProviderRequest {
    @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    @IsOptional()
    name?: string;

    @IsString()
    @MaxLength(2000)
    @IsOptional()
    notes?: string;

    defaultRule?: SubmissionRule;

    @IsBoolean()
    @IsOptional()
    archived?: boolean;
}
