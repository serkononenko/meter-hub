import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Public } from '../auth/public.decorator.js';

/**
 * Health/readiness endpoint (conventions §13 — the NestJS equivalent of
 * Spring's /actuator/health). Reports the process as UP plus database
 * connectivity; returns 503 with the failing component when the DB is
 * unreachable so orchestrators can route accordingly. Public: orchestrators
 * cannot present bearer tokens.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<{ status: string; components: Record<string, string> }> {
    const components: Record<string, string> = { database: 'DOWN' };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      components.database = 'UP';
    } catch {
      // Swallow the driver error — its text can contain connection strings.
      throw new ServiceUnavailableException({ status: 'DOWN', components });
    }
    return { status: 'UP', components };
  }
}
