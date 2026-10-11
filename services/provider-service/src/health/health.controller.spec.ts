import {ServiceUnavailableException} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import {TerminusModule} from '@nestjs/terminus';
import {describe, expect, it, beforeEach} from 'vitest';
import {HealthController} from './health.controller.js';
import {PrismaService} from '../database/prisma.service.js';

describe('HealthController', () => {
    let controller: HealthController;
    let prisma: { $runCommandRaw: (command: unknown) => Promise<unknown> };

    beforeEach(async () => {
        prisma = {
            $runCommandRaw: async () => ({ok: 1}),
        };

        const moduleRef = await Test.createTestingModule({
            imports: [TerminusModule],
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

    it('reports ok when the database answers', async () => {
        const result = await controller.check();
        expect(result.status).toBe('ok');
        expect(result.details.prisma.status).toBe('up');
    });

    it('reports DOWN with 503 when the database is unreachable', async () => {
        prisma.$runCommandRaw = async () => {
            throw new Error('connection refused');
        };
        await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
    });

    it('liveness answers UP without touching the database', async () => {
        prisma.$runCommandRaw = async () => {
            throw new Error('should not be called');
        };
        expect(controller.live()).toEqual({status: 'UP'});
    });

    it('readiness checks the database like the aggregate endpoint', async () => {
        const result = await controller.ready();
        expect(result.status).toBe('ok');
        expect(result.details.prisma.status).toBe('up');

        prisma.$runCommandRaw = async () => {
            throw new Error('connection refused');
        };
        await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException);
    });
});
