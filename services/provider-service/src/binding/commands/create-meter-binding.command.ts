import {IsOptional, IsUUID} from "class-validator";

import {IsCalendarDate} from "../../validation/calendar-date.constraint.js";

import type {CreateMeterBindingRequest} from "../../generated/provider/models/index.js";


export class CreateMeterBindingCommand implements CreateMeterBindingRequest {
    @IsUUID()
    accountId: string;

    @IsUUID()
    meterId: string;

    @IsOptional()
    @IsCalendarDate()
    validFrom?: string;
}
