import {NestFactory} from '@nestjs/core';
import {ConfigService} from "@nestjs/config";
import helmet from 'helmet';
import {AppModule, ObserveInstrument} from './app.module.js';


async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        instrument: ObserveInstrument,
    });

    app.use(helmet());

    const configService = app.get(ConfigService);
    const port = configService.get('port');

    await app.listen(port);
}

await bootstrap();
