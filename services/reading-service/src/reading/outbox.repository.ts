import {Injectable} from '@nestjs/common';
import {ClsService} from 'nestjs-cls';
import {PrismaService} from '../database/prisma.service.js';
import {Prisma} from '../generated/prisma/client.js';

import type {ReadingOutbox as OutboxRow} from '../generated/prisma/client.js';
import type {MeterReadingCreated} from '../generated/events/reading-created.v1.schema.js';


/** A pending event: the envelope plus the trace context for the produce span. */
export type OutboxEntry = {
    id: string;
    eventType: string;
    payload: MeterReadingCreated;
    traceparent: string | null;
    createdAt: Date;
};

@Injectable()
export class OutboxRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cls: ClsService,
    ) {
    }

    /**
     * Inserts the outbox row inside the caller's transaction — the atomic
     * half of the outbox pattern (spec 5 §5): the event exists iff the
     * reading does. The traceparent comes from the CLS request store, so
     * callers don't thread it through — the reading row and its trace
     * context commit atomically.
     */
    async save(event: MeterReadingCreated, tx?: Prisma.TransactionClient): Promise<void> {
        const client = tx ?? this.prisma;

        await client.readingOutbox.create({
            data: {
                id: event.eventId,
                aggregateId: event.data.meterId,
                eventType: event.eventType,
                payload: JSON.parse(JSON.stringify(event)),
                traceparent: this.cls.isActive() ? this.cls.get('traceparent') : null,
            },
        });
    }

    /** Unpublished events, FIFO. Bounded batch per relay round. */
    async findUnpublished(batchSize: number): Promise<OutboxEntry[]> {
        const rows = await this.prisma.readingOutbox.findMany({
            where: {publishedAt: null},
            orderBy: {createdAt: 'asc'},
            take: batchSize,
        });
        return rows.map(toEntry);
    }

    /**
     * Marks a batch published; caller passes the ids it actually produced.
     * A single UPDATE is atomic on its own — no explicit transaction —
     * and the at-least-once guarantee comes from produce-before-mark
     * ordering, not from this statement.
     */
    async markPublished(ids: string[]): Promise<void> {
        await this.prisma.readingOutbox.updateMany({
            where: {id: {in: ids}},
            data: {publishedAt: new Date()},
        });
    }

    async countUnpublished(): Promise<number> {
        return this.prisma.readingOutbox.count({where: {publishedAt: null}});
    }
}

function toEntry(row: OutboxRow): OutboxEntry {
    return {
        id: row.id,
        eventType: row.eventType,
        payload: row.payload as unknown as MeterReadingCreated,
        traceparent: row.traceparent,
        createdAt: row.createdAt,
    };
}
