import {Controller, Get} from '@nestjs/common';
import {HealthCheck, HealthCheckService, HealthIndicatorFunction, PrismaHealthIndicator} from "@nestjs/terminus";
import {PrismaService} from '../database/prisma.service.js';
import {Public} from "../decorators/public.decorator.js";

@Public()
@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly prismaHealth: PrismaHealthIndicator,
        private readonly prisma: PrismaService,
    ) {
    }

    @Get('live')
    live() {
        return {status: 'UP'};
    }

    @Get('ready')
    @HealthCheck()
    ready() {
        return this.health.check(this.dependencyChecks());
    }

    @Get()
    @HealthCheck()
    check() {
        return this.health.check(this.dependencyChecks());
    }

    private dependencyChecks(): HealthIndicatorFunction[] {
        return [async () => this.prismaHealth.pingCheck('prisma', this.prisma)];
    }
}
