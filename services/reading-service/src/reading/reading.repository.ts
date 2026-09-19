import {Injectable} from '@nestjs/common';
import {PrismaService} from '../database/prisma.service.js';

import type {Reading as ReadingRow, Prisma} from '../database/generated/prisma/client.js';
import type {Reading} from "./generated/models/index.js";


const READING_SELECT = {
    id: true,
    meterId: true,
    value: true,
    recordedAt: true,
    source: true,
    createdAt: true,
} satisfies Prisma.ReadingSelect;

@Injectable()
export class ReadingRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async save(reading: Reading): Promise<Reading> {
        const row = await this.prisma.reading.create({
            data: {
                id: reading.id,
                meterId: reading.meterId,
                value: reading.value,
                recordedAt: new Date(reading.recordedAt),
                source: reading.source,
            },
            select: READING_SELECT,
        });
        return toReading(row);
    }

    async findById(id: string): Promise<Reading | null> {
        const row = await this.prisma.reading.findUnique({where: {id}, select: READING_SELECT});
        return row ? toReading(row) : null;
    }

    async findByMeterId(meterId: string): Promise<Reading[]> {
        const rows = await this.prisma.reading.findMany({
            where: {meterId},
            orderBy: {recordedAt: 'desc'},
            select: READING_SELECT,
        });
        return rows.map(toReading);
    }
}

function toReading(row: ReadingRow): Reading {
    return {
        id: row.id,
        meterId: row.meterId,
        value: row.value.toNumber(),
        recordedAt: row.recordedAt.toISOString(),
        source: row.source,
        createdAt: row.createdAt.toISOString(),
    };
}
