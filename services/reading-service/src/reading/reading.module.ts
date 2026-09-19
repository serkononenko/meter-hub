import {Module} from '@nestjs/common';
import {ReadingRepository} from './reading.repository.js';
import {ReadingService} from './reading.service.js';
import {ApiImplementations, ApiModule} from "./generated/index.js";


const apiImplementations: ApiImplementations = {
    readingsApi: ReadingService
}

@Module({
    imports: [
        ApiModule.forRoot({
            apiImplementations: apiImplementations,
            providers: [
                ReadingRepository,
            ]
        })
    ],
})
export class ReadingModule {
}
