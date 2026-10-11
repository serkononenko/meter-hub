import {IsCalendarDate} from "../../validation/calendar-date.constraint.js";

import type {EndMeterBindingRequest} from "../../generated/provider/models/index.js";


export class EndMeterBindingCommand implements EndMeterBindingRequest {
    @IsCalendarDate()
    validTo: string;
}
