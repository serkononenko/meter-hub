import {describe, expect, it, vi} from 'vitest';
import {ReadingSource} from '../database/generated/prisma/enums.js';
import {PrismaService} from '../database/prisma.service.js';
import {ReadingRepository} from './reading.repository.js';

const READING_ROW = {
    id: '2b7e9a10-1c44-4c7e-8f5a-9d3b6c2e1a40',
    meterId: '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01',
    value: {
        toNumber: () => 1234.567891,
    },
    recordedAt: new Date('2026-08-27T08:30:00Z'),
    source: ReadingSource.MANUAL,
    createdAt: new Date('2026-08-27T08:31:00Z'),
};

function prismaStub() {
    const reading = {
        create: vi.fn().mockResolvedValue(READING_ROW),
        findUnique: vi.fn().mockResolvedValue(READING_ROW),
        findMany: vi.fn().mockResolvedValue([READING_ROW]),
    };
    return {reading};
}

function repositoryWith(delegate: ReturnType<typeof prismaStub>) {
    return new ReadingRepository(delegate as unknown as PrismaService);
}

describe('ReadingRepository', () => {
    it('persists a reading without overwriting generated timestamps', async () => {
        const delegate = prismaStub();
        const repository = repositoryWith(delegate);

        const reading = await repository.save({
            id: READING_ROW.id,
            meterId: READING_ROW.meterId,
            value: 1234.567891,
            recordedAt: READING_ROW.recordedAt.toISOString(),
            source: ReadingSource.MANUAL,
            createdAt: READING_ROW.createdAt.toISOString(),
        });

        expect(delegate.reading.create).toHaveBeenCalledWith({
            data: expect.not.objectContaining({createdAt: expect.anything()}),
            select: expect.anything(),
        });
        expect(reading).toMatchObject({
            id: READING_ROW.id,
            meterId: READING_ROW.meterId,
            value: 1234.567891,
            recordedAt: '2026-08-27T08:30:00.000Z',
            source: ReadingSource.MANUAL,
            createdAt: '2026-08-27T08:31:00.000Z',
        });
    });

    it('finds a reading by id', async () => {
        const delegate = prismaStub();
        const repository = repositoryWith(delegate);

        const reading = await repository.findById(READING_ROW.id);

        expect(delegate.reading.findUnique).toHaveBeenCalledWith({
            where: {id: READING_ROW.id},
            select: expect.anything(),
        });
        expect(reading?.id).toBe(READING_ROW.id);
    });

    it('returns null when no reading matches the id', async () => {
        const delegate = prismaStub();
        delegate.reading.findUnique = vi.fn().mockResolvedValue(null);
        const repository = repositoryWith(delegate);

        expect(await repository.findById(READING_ROW.id)).toBeNull();
    });

    it('lists readings of a meter newest first', async () => {
        const delegate = prismaStub();
        const repository = repositoryWith(delegate);

        const readings = await repository.findByMeterId(READING_ROW.meterId);

        expect(delegate.reading.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {meterId: READING_ROW.meterId},
                orderBy: {recordedAt: 'desc'},
            }),
        );
        expect(readings).toHaveLength(1);
        expect(readings[0].meterId).toBe(READING_ROW.meterId);
    });
});
