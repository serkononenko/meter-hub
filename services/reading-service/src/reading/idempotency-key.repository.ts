import {Injectable} from '@nestjs/common';
import {PrismaService} from '../database/prisma.service.js';
import {Prisma} from '../generated/prisma/client.js';

import type {IdempotencyKey as IdempotencyKeyRow} from '../generated/prisma/client.js';


export interface ReplayRecord {
    key: string;
    userId: string;
    requestHash: string;
    responseStatus: number;
    responseBody: unknown;
}

@Injectable()
export class IdempotencyKeyRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async find(key: string): Promise<ReplayRecord | null> {
        const row = await this.prisma.idempotencyKey.findUnique({where: {key}});
        return row ? toReplayRecord(row) : null;
    }

    async save(record: ReplayRecord, expiresAt: Date): Promise<void> {
        await this.prisma.idempotencyKey.create({
            data: {
                key: record.key,
                userId: record.userId,
                requestHash: record.requestHash,
                responseStatus: record.responseStatus,
                responseBody: (record.responseBody ?? Prisma.JsonNull) as Prisma.InputJsonValue,
                expiresAt,
            },
        });
    }

    async deleteExpired(now: Date): Promise<number> {
        const result = await this.prisma.idempotencyKey.deleteMany({where: {expiresAt: {lte: now}}});
        return result.count;
    }
}

function toReplayRecord(row: IdempotencyKeyRow): ReplayRecord {
    return {
        key: row.key,
        userId: row.userId,
        requestHash: row.requestHash,
        responseStatus: row.responseStatus,
        responseBody: row.responseBody,
    };
}
