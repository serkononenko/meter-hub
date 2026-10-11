import {Injectable} from '@nestjs/common';
import {PrismaService} from '../database/prisma.service.js';
import {parseDate, toBinding} from './binding.mapper.js';

import type {Prisma} from '../generated/prisma/client.js';
import type {MeterBinding} from '../generated/provider/models/index.js';


export interface NewBinding {
    id: string;
    accountId: string;
    householdId: string;
    meterId: string;
    validFrom: string;
    actorId: string;
}

@Injectable()
export class MeterBindingRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async lockMeter(meterId: string, tx: Prisma.TransactionClient): Promise<void> {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${meterId}, 0)) IS NOT NULL AS locked`;
    }

    async save(binding: NewBinding, tx: Prisma.TransactionClient): Promise<MeterBinding> {
        const row = await tx.meterBinding.create({
            data: {
                id: binding.id,
                accountId: binding.accountId,
                householdId: binding.householdId,
                meterId: binding.meterId,
                validFrom: parseDate(binding.validFrom),
                createdBy: binding.actorId,
                updatedBy: binding.actorId,
            },
        });
        return toBinding(row);
    }

    async findById(id: string, tx?: Prisma.TransactionClient): Promise<MeterBinding | null> {
        const row = await (tx ?? this.prisma).meterBinding.findUnique({where: {id}});
        return row ? toBinding(row) : null;
    }

    async findByMeter(meterId: string): Promise<MeterBinding[]> {
        const rows = await this.prisma.meterBinding.findMany({
            where: {meterId},
            orderBy: [{validFrom: 'desc'}, {createdAt: 'desc'}],
        });
        return rows.map(toBinding);
    }

    async findByAccount(accountId: string): Promise<MeterBinding[]> {
        const rows = await this.prisma.meterBinding.findMany({
            where: {accountId},
            orderBy: [{validFrom: 'asc'}, {createdAt: 'asc'}],
        });
        return rows.map(toBinding);
    }

    /** A new binding runs from validFrom with no end, so any binding that has not ended before then overlaps it. */
    async overlapsOpenEndedFrom(meterId: string, validFrom: string, tx: Prisma.TransactionClient): Promise<boolean> {
        const overlapping = await tx.meterBinding.count({
            where: {meterId, OR: [{validTo: null}, {validTo: {gte: parseDate(validFrom)}}]},
        });
        return overlapping > 0;
    }

    async end(id: string, validTo: string, actorId: string, tx: Prisma.TransactionClient): Promise<MeterBinding> {
        const row = await tx.meterBinding.update({
            where: {id},
            data: {validTo: parseDate(validTo), version: {increment: 1}, updatedBy: actorId},
        });
        return toBinding(row);
    }
}
