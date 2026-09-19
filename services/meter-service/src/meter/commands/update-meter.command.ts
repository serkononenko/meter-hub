import {IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength} from "class-validator";

import {AtLeastOneField} from '../../decorators/validation/at-least-one-field.decorator.js';
import {MeterStatus, MeterUnit, UpdateMeterRequest} from "../generated/models/index.js";


@AtLeastOneField()
export class UpdateMeterCommand implements UpdateMeterRequest {
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    @IsOptional()
    name?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    @IsOptional()
    serialNumber?: string;

    @IsEnum(MeterUnit)
    @IsOptional()
    unit?: MeterUnit;

    @IsEnum(MeterStatus)
    @IsOptional()
    status?: MeterStatus;
}
