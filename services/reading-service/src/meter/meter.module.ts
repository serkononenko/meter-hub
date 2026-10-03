import {Module} from '@nestjs/common';
import {MeterApiProvider} from './meter-api.provider.js';
import {MeterService} from './meter.service.js';


@Module({
    providers: [MeterApiProvider, MeterService],
    exports: [MeterService],
})
export class MeterModule {
}
