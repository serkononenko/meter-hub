import {Module} from '@nestjs/common';
import {ConfigModule} from "@nestjs/config";
import {DatabaseModule} from './database/database.module.js';
import {HealthModule} from './health/health.module.js';
import configuration from './config/configuration.js';
import {LoggingModule} from './logging/logging.module.js';
import {MetricsModule} from './metrics/metrics.module.js';
import {ConsumerModule} from './consumer/consumer.module.js';


@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        LoggingModule,
        MetricsModule,
        DatabaseModule,
        HealthModule,
        ConsumerModule,
    ],
})
export class AppModule {
}
