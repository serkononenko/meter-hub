import {Injectable} from '@nestjs/common';
import {ConfigService} from "@nestjs/config";
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from './generated/prisma/client.js';


@Injectable()
export class PrismaService extends PrismaClient {
    constructor(configService: ConfigService) {
        super({
            adapter: new PrismaPg({connectionString: configService.getOrThrow('database.url')}),
        });
    }
}
