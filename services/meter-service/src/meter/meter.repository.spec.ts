import {describe, expect, it, vi} from 'vitest';
import {MeterStatus, MeterType, MeterUnit} from '../database/generated/prisma/enums.js';
import {PrismaService} from '../database/prisma.service.js';
import {MeterRepository} from './meter.repository.js';

const METER_ROW = {
    id: '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01',
    householdId: '3f6a5b7c-93d2-4c8e-9a44-9f60f1f4c2aa',
    type: MeterType.ELECTRICITY,
    name: 'Main electricity meter',
    serialNumber: 'EL-123456',
    unit: MeterUnit.KWH,
    status: MeterStatus.ACTIVE,
    createdAt: new Date('2026-09-09T10:00:00Z'),
    updatedAt: new Date('2026-09-09T10:00:00Z'),
};

function prismaStub() {
    const meter = {
        create: vi.fn().mockResolvedValue(METER_ROW),
        findUnique: vi.fn().mockResolvedValue(METER_ROW),
        findMany: vi.fn().mockResolvedValue([METER_ROW]),
        update: vi.fn().mockResolvedValue(METER_ROW),
    };
    return {meter};
}

function repositoryWith(delegate: ReturnType<typeof prismaStub>) {
    return new MeterRepository(delegate as unknown as PrismaService);
}

describe('PrismaMeterRepository', () => {
    it('persists a meter without overwriting generated timestamps', async () => {
        const delegate = prismaStub();
        const repository = repositoryWith(delegate);

        const meter = await repository.save({
            id: METER_ROW.id,
            householdId: METER_ROW.householdId,
            type: MeterType.ELECTRICITY,
            name: METER_ROW.name,
            serialNumber: METER_ROW.serialNumber,
            unit: MeterUnit.KWH,
            status: MeterStatus.ACTIVE,
            createdAt: METER_ROW.createdAt.toISOString(),
            updatedAt: METER_ROW.createdAt.toISOString(),
        });

        expect(delegate.meter.create).toHaveBeenCalledWith({
            data: expect.not.objectContaining({updatedAt: expect.anything()}),
            select: expect.anything(),
        });
        expect(meter).toMatchObject({
            id: METER_ROW.id,
            householdId: METER_ROW.householdId,
            type: MeterType.ELECTRICITY,
            serialNumber: METER_ROW.serialNumber,
            unit: MeterUnit.KWH,
            status: MeterStatus.ACTIVE,
        });
    });

    it('returns null instead of a meter when findById misses', async () => {
        const delegate = prismaStub();
        delegate.meter.findUnique.mockResolvedValue(null);
        const repository = repositoryWith(delegate);

        await expect(repository.findById('e3978b32-0000-4000-8000-000000000000')).resolves.toBeNull();
    });

    it('lists meters of a household ordered by creation time', async () => {
        const delegate = prismaStub();
        const repository = repositoryWith(delegate);

        const meters = await repository.findByHouseholdId(METER_ROW.householdId);

        expect(delegate.meter.findMany).toHaveBeenCalledWith({
            where: {householdId: METER_ROW.householdId},
            orderBy: {createdAt: 'asc'},
            select: expect.anything(),
        });
        expect(meters).toHaveLength(1);
        expect(meters[0].householdId).toBe(METER_ROW.householdId);
    });

    it('passes only the provided fields to update', async () => {
        const delegate = prismaStub();
        const repository = repositoryWith(delegate);

        await repository.update(METER_ROW.id, {status: MeterStatus.ARCHIVED});

        expect(delegate.meter.update).toHaveBeenCalledWith({
            where: {id: METER_ROW.id},
            data: {status: MeterStatus.ARCHIVED},
            select: expect.anything(),
        });
    });
});
