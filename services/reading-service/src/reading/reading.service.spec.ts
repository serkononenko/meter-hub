import {describe, expect, it, vi} from 'vitest';
import {ReadingService} from './reading.service.js';
import {ReadingRepository} from './reading.repository.js';
import {RequestValidationException} from '../exceptions/request-validation.exception.js';

const METER_ID = '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01';
const SAVED = {
    id: '2b7e9a10-1c44-4c7e-8f5a-9d3b6c2e1a40',
    meterId: METER_ID,
    value: 15432.1,
    recordedAt: '2026-08-27T08:30:00.000Z',
    source: 'MANUAL',
    createdAt: '2026-09-19T10:00:00.000Z',
};

function repositoryStub() {
    return {
        save: vi.fn().mockResolvedValue(SAVED),
        findById: vi.fn().mockResolvedValue(SAVED),
        findByMeterId: vi.fn().mockResolvedValue([SAVED]),
    };
}

function serviceWith(repository: ReturnType<typeof repositoryStub>) {
    return new ReadingService(repository as unknown as ReadingRepository);
}

describe('ReadingService', () => {
    it('saves a valid reading with MANUAL source and UTC timestamps', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        const reading = await service.createReading({
            meterId: METER_ID,
            value: 15432.1,
            recordedAt: '2026-08-27T08:30:00Z',
        });

        expect(reading).toMatchObject(SAVED);
        expect(repository.save).toHaveBeenCalledWith(
            expect.objectContaining({
                meterId: METER_ID,
                value: 15432.1,
                recordedAt: '2026-08-27T08:30:00.000Z',
                source: 'MANUAL',
            }),
        );
        // The persisted id is generated server-side, not taken from input.
        const saved = repository.save.mock.calls[0][0];
        expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('normalizes a recordedAt with offset to UTC Z form', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await service.createReading({
            meterId: METER_ID,
            value: 1,
            recordedAt: '2026-08-27T10:30:00+02:00',
        });

        expect(repository.save).toHaveBeenCalledWith(
            expect.objectContaining({recordedAt: '2026-08-27T08:30:00.000Z'}),
        );
    });

    it('rejects a negative value with a validation problem', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.createReading({meterId: METER_ID, value: -1, recordedAt: '2026-08-27T08:30:00Z'}))
            .rejects.toBeInstanceOf(RequestValidationException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric value with a validation problem', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.createReading({
            meterId: METER_ID,
            value: 'high' as unknown as number,
            recordedAt: '2026-08-27T08:30:00Z',
        })).rejects.toBeInstanceOf(RequestValidationException);
    });

    it('rejects a non-timestamp recordedAt with a validation problem', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.createReading({meterId: METER_ID, value: 1, recordedAt: 'yesterday'}))
            .rejects.toBeInstanceOf(RequestValidationException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a non-uuid meterId with a validation problem', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.createReading({meterId: 'not-a-uuid', value: 1, recordedAt: '2026-08-27T08:30:00Z'}))
            .rejects.toBeInstanceOf(RequestValidationException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a missing recordedAt with a validation problem', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.createReading({
            meterId: METER_ID,
            value: 1,
        } as never)).rejects.toBeInstanceOf(RequestValidationException);
        expect(repository.save).not.toHaveBeenCalled();
    });
});
