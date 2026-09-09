import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../database/prisma.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: (strings: TemplateStringsArray) => Promise<unknown> };

  beforeEach(async () => {
    prisma = {
      $queryRaw: async () => [],
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    })
      .useMocker((token) => {
        if (token === PrismaService) {
          return prisma;
        }
        return {};
      })
      .compile();

    controller = moduleRef.get(HealthController);
  });

  it('reports UP when the database answers', async () => {
    const result = await controller.check();
    expect(result.status).toBe('UP');
    expect(result.components.database).toBe('UP');
  });

  it('reports DOWN with 503 when the database is unreachable', async () => {
    prisma.$queryRaw = async () => {
      throw new Error('connection refused');
    };
    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });
});
