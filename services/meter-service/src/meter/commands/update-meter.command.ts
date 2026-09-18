import {IsEnum, IsOptional, IsString} from "class-validator";

import {MeterStatus, MeterUnit, UpdateMeterRequest} from "../generated/models/index.js";


export class UpdateMeterCommand implements UpdateMeterRequest {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    serialNumber?: string;

    @IsEnum(MeterUnit)
    @IsOptional()
    unit?: MeterUnit;

    @IsEnum(MeterStatus)
    @IsOptional()
    status?: MeterStatus;
}