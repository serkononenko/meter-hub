import {Module} from '@nestjs/common';
import {MeterRepository} from './meter.repository.js';
import {MeterService} from './meter.service.js';
import {ApiImplementations, ApiModule} from "./generated/index.js";
import {HouseholdService} from "../household/household.service.js";
import {HouseholdApiProvider} from "../household/household-api.provider.js";


const apiImplementations: ApiImplementations = {
    metersApi: MeterService
}

@Module({
    imports: [
        ApiModule.forRoot({
            apiImplementations: apiImplementations,
            providers: [
                MeterRepository,
                HouseholdApiProvider,
                HouseholdService
            ]
        })
    ],
})
export class MeterModule {
}
