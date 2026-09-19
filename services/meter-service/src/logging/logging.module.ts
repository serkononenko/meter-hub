import {Global, Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {StructuredLoggerService} from './structured-logger.service.js';

/**
 * Provides the structured logger application-wide (conventions §14).
 */
@Global()
@Module({
    providers: [
        {
            provide: StructuredLoggerService,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => new StructuredLoggerService(config.get<string>('logLevel') ?? 'info'),
        },
    ],
    exports: [StructuredLoggerService],
})
export class LoggingModule {}
