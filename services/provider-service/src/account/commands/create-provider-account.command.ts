import {Transform} from "class-transformer";
import {IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength} from "class-validator";

import type {CreateProviderAccountRequest, SubmissionRule} from "../../generated/provider/models/index.js";


const trim = ({value}: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateProviderAccountCommand implements CreateProviderAccountRequest {
    @IsUUID()
    providerId: string;

    @IsUUID()
    householdId: string;

    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    label: string;

    @Transform(trim)
    @IsOptional()
    @IsString()
    @MaxLength(100)
    accountNumber?: string;

    rule?: SubmissionRule;
}
