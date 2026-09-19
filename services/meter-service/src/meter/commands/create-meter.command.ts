import {IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength} from "class-validator";

import {CreateMeterRequest, MeterType, MeterUnit} from "../generated/models/index.js";


export class CreateMeterCommand implements CreateMeterRequest {
    @IsUUID()
    householdId: string;

    @IsString()
    @IsNotEmpty()
    @IsEnum(MeterType)
    type: MeterType;

    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    name: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    serialNumber: string;

    @IsString()
    @IsNotEmpty()
    @IsEnum(MeterUnit)
    unit: MeterUnit;
}
