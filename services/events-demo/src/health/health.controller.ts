import {Controller, Get} from '@nestjs/common';
import {HealthCheck, HealthCheckService, HealthIndicatorFunction, PrismaHealthIndicator} from "@nestjs/terminus";
import {PrismaService} from '../database/prisma.service.js';

/**
 * Health probes per conventions §13: liveness and readiness are separate
 * concerns. `/health/live` answers "is the process up" with no dependency
 * checks; `/health/ready` includes the database so orchestration can stop
 * routing traffic when it is unreachable; `/health` keeps the aggregate
 * view for humans and conventions compatibility.
 *
 * Kafka connectivity is deliberately not a readiness gate (conventions
 * §13): the consumer loop reconnects on its own and falls behind (lag)
 * rather than going unready — the dashboard watches lag, K4.
 */
@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly prismaHealth: PrismaHealthIndicator,
        private readonly prisma: PrismaService,
    ) {
    }

    /** Liveness: process is up. Never checks dependencies. */
    @Get('live')
    live() {
        return {status: 'UP'};
    }

    /** Readiness: process is up and the database answers. */
    @Get('ready')
    @HealthCheck()
    ready() {
        return this.health.check(this.dependencyChecks());
    }

    /** Aggregate health for humans (conventions §13 `GET /health`). */
    @Get()
    @HealthCheck()
    check() {
        return this.health.check(this.dependencyChecks());
    }

    private dependencyChecks(): HealthIndicatorFunction[] {
        return [async () => this.prismaHealth.pingCheck('prisma', this.prisma)];
    }
}
