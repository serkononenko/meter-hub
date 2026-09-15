import {Controller, Get} from '@nestjs/common';
import {HealthCheck, HealthCheckService, PrismaHealthIndicator} from "@nestjs/terminus";
import {PrismaService} from '../database/prisma.service.js';


@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly prismaHealth: PrismaHealthIndicator,
        private readonly prisma: PrismaService,
    ) {
    }

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            async () => this.prismaHealth.pingCheck('prisma', this.prisma),
        ]);
    }
}
