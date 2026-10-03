import {Global, Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {ClsService} from 'nestjs-cls';
import {StructuredLoggerService} from './structured-logger.service.js';


@Global()
@Module({
    providers: [
        {
            provide: StructuredLoggerService,
            inject: [ConfigService, ClsService],
            useFactory: (config: ConfigService, cls: ClsService) => {
                return new StructuredLoggerService(cls, config.get<string>('logLevel') ?? 'info');
            },
        },
    ],
    exports: [StructuredLoggerService],
})
export class LoggingModule {}
