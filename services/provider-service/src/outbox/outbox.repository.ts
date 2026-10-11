import {Injectable} from '@nestjs/common';
import {ClsService} from 'nestjs-cls';
import {PrismaService} from '../database/prisma.service.js';

import type {Prisma, ProviderOutbox as OutboxRow} from '../generated/prisma/client.js';
import type {ProviderAccountChanged} from '../generated/events/account-changed.v1.schema.js';
import type {ProviderBindingChanged} from '../generated/events/binding-changed.v1.schema.js';


export type ProviderEvent = ProviderAccountChanged | ProviderBindingChanged;

export type OutboxEntry = {
    id: string;
    eventType: string;
    aggregateKey: string;
    payload: ProviderEvent;
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

    async save(event: ProviderEvent, aggregateId: string, tx: Prisma.TransactionClient): Promise<void> {
        await tx.providerOutbox.create({
            data: {
                id: event.eventId,
                aggregateId,
                eventType: event.eventType,
                payload: JSON.parse(JSON.stringify(event)),
                traceparent: this.cls.isActive() ? this.cls.get('traceparent') : null,
            },
        });
    }

    async findUnpublished(batchSize: number): Promise<OutboxEntry[]> {
        const rows = await this.prisma.providerOutbox.findMany({
            where: {publishedAt: null},
            orderBy: {createdAt: 'asc'},
            take: batchSize,
        });
        return rows.map(toEntry);
    }

    async markPublished(ids: string[]): Promise<void> {
        await this.prisma.providerOutbox.updateMany({
            where: {id: {in: ids}},
            data: {publishedAt: new Date()},
        });
    }

    async countUnpublished(): Promise<number> {
        return this.prisma.providerOutbox.count({where: {publishedAt: null}});
    }
}

function toEntry(row: OutboxRow): OutboxEntry {
    return {
        id: row.id,
        eventType: row.eventType,
        aggregateKey: row.aggregateId,
        payload: row.payload as unknown as ProviderEvent,
        traceparent: row.traceparent,
        createdAt: row.createdAt,
    };
}
