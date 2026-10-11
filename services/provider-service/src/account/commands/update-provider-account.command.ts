import {Transform} from "class-transformer";
import {IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength} from "class-validator";

import {AtLeastOneField} from "../../decorators/validation/at-least-one-field.decorator.js";

import type {SubmissionRule, UpdateProviderAccountRequest} from "../../generated/provider/models/index.js";


const trim = ({value}: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

@AtLeastOneField()
export class UpdateProviderAccountCommand implements UpdateProviderAccountRequest {
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    @IsOptional()
    label?: string;

    @Transform(trim)
    @IsString()
    @MaxLength(100)
    @IsOptional()
    accountNumber?: string;

    rule?: SubmissionRule;

    @IsUUID()
    @IsOptional()
    providerId?: string;

    @IsBoolean()
    @IsOptional()
    archived?: boolean;
}
