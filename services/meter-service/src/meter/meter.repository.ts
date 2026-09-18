import {Injectable} from '@nestjs/common';
import {PrismaService} from '../database/prisma.service.js';

import type {Meter as MeterRow, Prisma} from '../database/generated/prisma/client.js';
import type {Meter} from "./generated/models/index.js";


interface MeterUpdate {
    name?: string;
    serialNumber?: string;
    unit?: MeterRow['unit'];
    status?: MeterRow['status'];
}

const METER_SELECT = {
    id: true,
    householdId: true,
    type: true,
    name: true,
    serialNumber: true,
    unit: true,
    status: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.MeterSelect;

@Injectable()
export class MeterRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async save(meter: Meter): Promise<Meter> {
        const row = await this.prisma.meter.create({
            data: {
                id: meter.id,
                householdId: meter.householdId,
                type: meter.type,
                name: meter.name,
                serialNumber: meter.serialNumber,
                unit: meter.unit,
                status: meter.status,
                createdAt: meter.createdAt,
            },
            select: METER_SELECT,
        });
        return toMeter(row);
    }

    async findById(id: string): Promise<Meter | null> {
        const row = await this.prisma.meter.findUnique({where: {id}, select: METER_SELECT});
        return row ? toMeter(row) : null;
    }

    async findByHouseholdId(householdId: string): Promise<Meter[]> {
        const rows = await this.prisma.meter.findMany({
            where: {householdId},
            orderBy: {createdAt: 'asc'},
            select: METER_SELECT,
        });
        return rows.map(toMeter);
    }

    async update(id: string, data: MeterUpdate): Promise<Meter | null> {
        const row = await this.prisma.meter.update({
            where: {id},
            data,
            select: METER_SELECT,
        });
        return row ? toMeter(row) : null;
    }
}

function toMeter(row: MeterRow): Meter {
    return {
        id: row.id,
        householdId: row.householdId,
        type: row.type,
        name: row.name,
        serialNumber: row.serialNumber,
        unit: row.unit,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
