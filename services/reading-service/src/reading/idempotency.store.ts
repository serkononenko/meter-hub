import {Injectable} from '@nestjs/common';
import {IdempotencyStorage} from '@nestjs/idempotency';
import {createHash} from 'node:crypto';
import {PrismaService} from '../database/prisma.service.js';

import type {
    IdempotencyAcquireResult,
    IdempotencyStore,
    IdempotencyStoredPayload,
} from '@nestjs/idempotency';
import type {Prisma} from '../generated/prisma/client.js';


interface IdempotencyKeyRow {
    key_hash: string;
    fingerprint: string;
    owner: string | null;
    response: IdempotencyStoredPayload | null;
    expires_at: bigint;
}

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

        // Insert the lock, or take over an expired row. Of many concurrent
        // callers PostgreSQL lets exactly one write; the re-checked
        // overwrite condition makes the losers re-evaluate against the
        // winner's row, so they get nothing back.
        const inserted = await this.prisma.$queryRaw<IdempotencyKeyRow[]>`
            INSERT INTO "idempotency_keys" ("key_hash", "key", "fingerprint", "owner", "response", "expires_at")
            VALUES (${sha256(key)}, ${key}, ${fingerprint}, ${owner}, NULL, ${now + lockTtl})
            ON CONFLICT ("key_hash") DO UPDATE
                SET "fingerprint" = EXCLUDED."fingerprint",
                    "owner" = EXCLUDED."owner",
                    "response" = NULL,
                    "expires_at" = EXCLUDED."expires_at"
                WHERE "idempotency_keys"."expires_at" <= ${now}
            RETURNING "key_hash"
        `;

        if (inserted.length === 1) {
            return {state: 'acquired'};
        }

        // Someone else holds the key: report their lock or record.
        const row = await this.findRow(key);

        if (!row || row.expires_at <= now) {
            // The row was released or expired between the two statements.
            // The interceptor retries the whole acquire on its next request;
            // surfacing state here would be a lie, so report the lock as
            // in-flight only when it is live.
            throw new IdempotencyRecordChangedError(key);
        }

        return row.response === null
            ? {state: 'in-flight', fingerprint: row.fingerprint}
            : {state: 'completed', fingerprint: row.fingerprint, response: row.response};
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

    /**
     * Deletes up to `limit` expired rows, for a scheduled job. Expired rows
     * are already ignored (and taken over) by `acquire()`, so this is
     * housekeeping, not a correctness requirement.
     */
    async prune(limit = 1000): Promise<number> {
        const result = await this.prisma.$executeRaw`
            DELETE FROM "idempotency_keys"
            WHERE "key_hash" IN (
                SELECT "key_hash" FROM "idempotency_keys" WHERE "expires_at" <= ${Date.now()} LIMIT ${limit}
            )
            AND "expires_at" <= ${Date.now()}
        `;
        return result;
    }

    private async findRow(key: string): Promise<IdempotencyKeyRow | null> {
        const rows = await this.prisma.$queryRaw<IdempotencyKeyRow[]>`
            SELECT "key_hash", "fingerprint", "owner", "response", "expires_at"
            FROM "idempotency_keys"
            WHERE "key_hash" = ${sha256(key)}
        `;
        return rows[0] ?? null;
    }
}

/** Raised when the record kept changing between acquire()'s two statements. */
export class IdempotencyRecordChangedError extends Error {
    constructor(key: string) {
        super(`The idempotency record for "${key}" kept changing; try again`);
    }
}

function sha256(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}
