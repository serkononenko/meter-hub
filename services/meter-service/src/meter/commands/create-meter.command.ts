import {IsEnum, IsNotEmpty, IsString, IsUUID} from "class-validator";

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
    name: string;

    @IsString()
    @IsNotEmpty()
    serialNumber: string;

    @IsString()
    @IsNotEmpty()
    @IsEnum(MeterUnit)
    unit: MeterUnit;
}