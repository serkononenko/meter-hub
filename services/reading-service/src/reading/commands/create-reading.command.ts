import {IsDateString, IsNotEmpty, IsNumber, IsUUID, Min} from "class-validator";

import {CreateReadingRequest} from "../generated/models/index.js";


export class CreateReadingCommand implements CreateReadingRequest {
    @IsUUID()
    meterId: string;

    @IsNumber()
    @Min(0)
    value: number;

    @IsNotEmpty()
    @IsDateString({strict: true})
    recordedAt: string;
}
