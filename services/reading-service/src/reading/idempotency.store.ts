import {Injectable} from '@nestjs/common';
import {IdempotencyStorage} from '@nestjs/idempotency';
import {createHash} from 'node:crypto';
import {PrismaService} from '../database/prisma.service.js';
import {acquire, findRow, prune} from '../generated/prisma/sql.js';

import type {
    IdempotencyAcquireResult,
    IdempotencyStore,
    IdempotencyStoredPayload,
} from '@nestjs/idempotency';
import type {Prisma} from '../generated/prisma/client.js';


@Injectable()
export class PrismaIdempotencyStore implements IdempotencyStore {
    constructor(
        private readonly prisma: PrismaService,
        storage: IdempotencyStorage,
    ) {
        storage.registerSource(this);
    }

    async acquire(key: string, owner: string, fingerprint: string, lockTtl: number): Promise<IdempotencyAcquireResult> {
        const now = Date.now();
        const inserted = await this.prisma.$queryRawTyped(acquire(sha256(key), key, fingerprint, owner, now + lockTtl, now));

        if (inserted.length === 1) {
            return {state: 'acquired'};
        }

        const row = await this.findRow(key);

        if (!row || row.expires_at <= now) {
            throw new IdempotencyRecordChangedError(key);
        }

        return row.response === null
            ? {state: 'in-flight', fingerprint: row.fingerprint}
            : {
                state: 'completed',
                fingerprint: row.fingerprint,
                response: row.response as unknown as IdempotencyStoredPayload
            };
    }

    async complete(key: string, owner: string, response: IdempotencyStoredPayload, ttl: number): Promise<boolean> {
        const now = Date.now();
        const result = await this.prisma.idempotencyKey.updateMany({
            where: {keyHash: sha256(key), owner, expiresAt: {gt: BigInt(now)}},
            data: {owner: null, response: response as unknown as Prisma.InputJsonValue, expiresAt: BigInt(now + ttl)},
        });
        return result.count === 1;
    }

    async release(key: string, owner: string): Promise<boolean> {
        const result = await this.prisma.idempotencyKey.deleteMany({
            where: {keyHash: sha256(key), owner, expiresAt: {gt: BigInt(Date.now())}},
        });
        return result.count === 1;
    }

    async extend(key: string, owner: string, lockTtl: number): Promise<boolean> {
        const now = Date.now();
        const result = await this.prisma.idempotencyKey.updateMany({
            where: {keyHash: sha256(key), owner, expiresAt: {gt: BigInt(now)}},
            data: {expiresAt: BigInt(now + lockTtl)},
        });
        return result.count === 1;
    }

    async prune(limit = 1000): Promise<number> {
        const deleted = await this.prisma.$queryRawTyped(prune(Date.now(), limit));
        return deleted.length;
    }

    private async findRow(key: string) {
        const rows = await this.prisma.$queryRawTyped(findRow(sha256(key)));
        return rows[0] ?? null;
    }
}

export class IdempotencyRecordChangedError extends Error {
    constructor(key: string) {
        super(`The idempotency record for "${key}" kept changing; try again`);
    }
}

function sha256(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}
