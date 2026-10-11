import {Module} from '@nestjs/common';
import {MeterApiProvider} from './meter-api.provider.js';
import {MeterLookupService} from './meter-lookup.service.js';


@Module({
    providers: [MeterApiProvider, MeterLookupService],
    exports: [MeterLookupService],
})
export class MeterModule {
}
