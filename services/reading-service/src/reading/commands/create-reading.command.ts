import {IsDateString, IsNotEmpty, IsNumber, IsUUID, Min} from "class-validator";

import {DateNotInFuture, DateNotOlderThan} from "../../decorators/date-window.decorators.js";
import {CreateReadingRequest} from "../../generated/reading/models/index.js";


export const RECORDED_AT_MAX_AGE_YEARS = 5;

export class CreateReadingCommand implements CreateReadingRequest {
    @IsUUID()
    meterId: string;

    @IsNumber()
    @Min(0)
    value: number;

    @IsNotEmpty()
    @IsDateString({strict: true})
    @DateNotInFuture()
    @DateNotOlderThan(RECORDED_AT_MAX_AGE_YEARS)
    recordedAt: string;
}
