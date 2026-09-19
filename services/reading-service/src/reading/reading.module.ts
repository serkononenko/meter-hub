import {Module} from '@nestjs/common';
import {ReadingRepository} from './reading.repository.js';
import {ReadingService} from './reading.service.js';
import {ApiImplementations, ApiModule} from "./generated/index.js";
import {MeterApiProvider} from "../meter/meter-api.provider.js";
import {MeterAccessService} from "../meter/meter-access.service.js";


const apiImplementations: ApiImplementations = {
    readingsApi: ReadingService
}

@Module({
    imports: [
        ApiModule.forRoot({
            apiImplementations: apiImplementations,
            providers: [
                ReadingRepository,
                MeterApiProvider,
                MeterAccessService,
            ]
        })
    ],
})
export class ReadingModule {
}
