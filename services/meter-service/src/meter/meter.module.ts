import {Module} from '@nestjs/common';
import {PrismaMeterRepository} from './meter.repository.js';
import {MeterController} from './meter.controller.js';
import {MeterService} from './meter.service.js';
import {METER_REPOSITORY} from './meter.tokens.js';
import {HouseholdModule} from '../household/household.module.js';


@Module({
    imports: [HouseholdModule],
    controllers: [MeterController],
    providers: [
        MeterService,
        {provide: METER_REPOSITORY, useClass: PrismaMeterRepository},
    ],
    exports: [METER_REPOSITORY],
})
export class MeterModule {
}
