import {describe, expect, it, vi} from 'vitest';
import {ReadingService} from './reading.service.js';
import {MeterService} from '../meter/meter.service.js';
import {HouseholdAccessService} from '../household/household-access.service.js';
import {ReadingRepository} from './reading.repository.js';
import {OutboxRepository} from './outbox.repository.js';
import {IdempotencyKeyRepository} from './idempotency-key.repository.js';
import {
    HouseholdNotFoundException,
    MeterNotFoundException,
    ReadingNotFoundException,
} from '../exceptions/not-found.exception.js';
import {ForbiddenRoleException} from '../exceptions/forbidden.exception.js';
import {HouseholdServiceUnavailableException} from '../exceptions/service-unavailable.exception.js';
import {ReadingDecreasingException} from '../exceptions/reading-argument.exception.js';
import {RequestValidationException} from '../exceptions/request-validation.exception.js';
import {REQUEST_USER} from '../auth/auth.constants.js';

const METER_ID = '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01';
const HOUSEHOLD_ID = '3f6a5b7c-93d2-4c8e-9a44-9f60f1f4c2aa';
const TEST_USER = '99999999-9999-4999-8999-999999999999';
/** Authenticated request the way the auth guard leaves it after verification. */
const REQUEST_STUB = {[REQUEST_USER]: {userId: TEST_USER}} as unknown as Request;
const SAVED = {
    id: '2b7e9a10-1c44-4c7e-8f5a-9d3b6c2e1a40',
    meterId: METER_ID,
    value: 15432.1,
    recordedAt: '2026-08-27T08:30:00.000Z',
    source: 'MANUAL',
    createdAt: '2026-09-19T10:00:00.000Z',
};
/** The meter stand-in returns; every test meter belongs to HOUSEHOLD_ID. */
const METER = {
    id: METER_ID,
    householdId: HOUSEHOLD_ID,
    type: 'ELECTRICITY',
    name: 'Test meter',
    serialNumber: 'EL-123456',
    unit: 'KWH',
    status: 'ACTIVE',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
};

function repositoryStub() {
    const repository = {
        findById: vi.fn().mockResolvedValue(SAVED),
        findByMeterId: vi.fn().mockResolvedValue([SAVED]),
        countByMeterId: vi.fn().mockResolvedValue(1),
        findLatestByMeterId: vi.fn().mockResolvedValue(SAVED),
        findPrevious: vi.fn().mockResolvedValue(null),
    };
    return Object.assign(repository, {
        // The service saves through the tx-scoped path (spec 5): save(tx,
        // reading, event). The stub ignores the tx and resolves SAVED so
        // existing assertions hold.
        save: vi.fn().mockResolvedValue(SAVED),
    });
}

function meterAccessStub() {
    return {
        getMeter: vi.fn().mockResolvedValue(METER),
    };
}

/** Stub household port: the test subject is a MEMBER of every household. */
function householdAccessStub() {
    return householdStub({member: true, role: 'MEMBER'});
}

/** Stub household port that always fails (household service unreachable). */
function householdDownStub(): HouseholdAccessService {
    return {
        assertCanWrite: vi.fn().mockRejectedValue(new HouseholdServiceUnavailableException()),
    } as unknown as HouseholdAccessService;
}

function householdStub(verdict: {member: boolean; role?: string}): HouseholdAccessService {
    if (!verdict.member) {
        return {
            assertCanWrite: vi.fn().mockRejectedValue(new HouseholdNotFoundException(HOUSEHOLD_ID)),
        } as unknown as HouseholdAccessService;
    }

    return {
        assertCanWrite: vi.fn().mockImplementation(() => {
            if (verdict.role === 'VIEWER') {
                return Promise.reject(new ForbiddenRoleException('VIEWER', 'submitting readings'));
            }
            return Promise.resolve(undefined);
        }),
    } as unknown as HouseholdAccessService;
}

function idempotencyKeyStub() {
    return {
        find: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(undefined),
        deleteExpired: vi.fn().mockResolvedValue(0),
    };
}

/** Outbox port stub: records the event the service attaches to a save. */
function outboxStub() {
    return {save: vi.fn().mockResolvedValue(undefined)};
}

/** TransactionManager stand-in: runs the callback against a fake tx. */
function transactionManagerStub() {
    return {
        execute: vi.fn().mockImplementation(
            async (fn: (tx: unknown) => Promise<unknown>) => fn({/* fake tx */}),
        ),
    };
}

function serviceWith(
    repository: ReturnType<typeof repositoryStub>,
    meterAccess: ReturnType<typeof meterAccessStub> = meterAccessStub(),
    idempotencyKeys: ReturnType<typeof idempotencyKeyStub> = idempotencyKeyStub(),
    householdAccess: HouseholdAccessService = householdAccessStub(),
) {
    return new ReadingService(
        transactionManagerStub() as never,
        repository as unknown as ReadingRepository,
        outboxStub() as unknown as OutboxRepository,
        idempotencyKeys as unknown as IdempotencyKeyRepository,
        meterAccess as unknown as MeterService,
        householdAccess,
    );
}

describe('ReadingService', () => {
    it('saves a valid reading with MANUAL source and UTC timestamps', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        const reading = await service.createReading({
            meterId: METER_ID,
            value: 15432.1,
            recordedAt: '2026-08-27T08:30:00Z',
        }, undefined, undefined, REQUEST_STUB);

        expect(reading).toMatchObject(SAVED);
        expect(repository.save).toHaveBeenCalledWith(
            expect.objectContaining({
                meterId: METER_ID,
                value: 15432.1,
                recordedAt: '2026-08-27T08:30:00.000Z',
                source: 'MANUAL',
            }),
            expect.anything(), // the tx client from TransactionManager
        );
        // The id is generated server-side, not taken from input.
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
        }, undefined, undefined, REQUEST_STUB);

        expect(repository.save).toHaveBeenCalledWith(
            expect.objectContaining({recordedAt: '2026-08-27T08:30:00.000Z'}),
            expect.anything(),
        );
    });

    it('rejects a negative value with a validation problem', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.createReading({meterId: METER_ID, value: -1, recordedAt: '2026-08-27T08:30:00Z'}, undefined, undefined, REQUEST_STUB))
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
        }, undefined, undefined, REQUEST_STUB)).rejects.toBeInstanceOf(RequestValidationException);
    });

    it('rejects a non-timestamp recordedAt with a validation problem', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.createReading({meterId: METER_ID, value: 1, recordedAt: 'yesterday'}, undefined, undefined, REQUEST_STUB))
            .rejects.toBeInstanceOf(RequestValidationException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a non-uuid meterId with a validation problem', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.createReading({meterId: 'not-a-uuid', value: 1, recordedAt: '2026-08-27T08:30:00Z'}, undefined, undefined, REQUEST_STUB))
            .rejects.toBeInstanceOf(RequestValidationException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a missing recordedAt with a validation problem', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.createReading({
            meterId: METER_ID,
            value: 1,
        } as never, undefined, undefined, REQUEST_STUB)).rejects.toBeInstanceOf(RequestValidationException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('lists readings newest first with default paging', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        const page = await service.listReadings(METER_ID, undefined, undefined, undefined, REQUEST_STUB);

        expect(repository.findByMeterId).toHaveBeenCalledWith(METER_ID, 50, 0);
        expect(page).toEqual({items: [SAVED], total: 1, limit: 50, offset: 0});
    });

    it('applies explicit paging bounds', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await service.listReadings(METER_ID, 10, 20, undefined, REQUEST_STUB);

        expect(repository.findByMeterId).toHaveBeenCalledWith(METER_ID, 10, 20);
    });

    it('caps the page size at the contract maximum', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await service.listReadings(METER_ID, 1000, 0, undefined, REQUEST_STUB);

        expect(repository.findByMeterId).toHaveBeenCalledWith(METER_ID, 200, 0);
    });

    it('falls back to defaults for out-of-range paging input', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await service.listReadings(METER_ID, 0, -5, undefined, REQUEST_STUB);

        expect(repository.findByMeterId).toHaveBeenCalledWith(METER_ID, 50, 0);
    });

    it('coerces string paging input from query parameters', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await service.listReadings(METER_ID, '2', '1', undefined, REQUEST_STUB);

        expect(repository.findByMeterId).toHaveBeenCalledWith(METER_ID, 2, 1);
    });

    it('returns the latest reading', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        const reading = await service.getLatestReading(METER_ID, undefined, REQUEST_STUB);

        expect(repository.findLatestByMeterId).toHaveBeenCalledWith(METER_ID);
        expect(reading).toEqual(SAVED);
    });

    it('answers 404 READING_NOT_FOUND when the meter has no readings', async () => {
        const repository = repositoryStub();
        repository.findLatestByMeterId = vi.fn().mockResolvedValue(null);
        const service = serviceWith(repository);

        await expect(service.getLatestReading(METER_ID, undefined, REQUEST_STUB)).rejects.toBeInstanceOf(ReadingNotFoundException);
    });

    it('verifies meter access before saving a reading', async () => {
        const repository = repositoryStub();
        const meterAccess = meterAccessStub();
        const service = serviceWith(repository, meterAccess);

        await service.createReading({meterId: METER_ID, value: 1, recordedAt: '2026-08-27T08:30:00Z'}, undefined, undefined, REQUEST_STUB);

        expect(meterAccess.getMeter).toHaveBeenCalledWith(METER_ID);
    });

    it('does not save a reading when the meter is not accessible', async () => {
        const repository = repositoryStub();
        const meterAccess = meterAccessStub();
        meterAccess.getMeter = vi.fn().mockRejectedValue(new MeterNotFoundException(METER_ID));
        const service = serviceWith(repository, meterAccess);

        await expect(service.createReading({meterId: METER_ID, value: 1, recordedAt: '2026-08-27T08:30:00Z'}, undefined, undefined, REQUEST_STUB))
            .rejects.toBeInstanceOf(MeterNotFoundException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('verifies meter access before listing history', async () => {
        const repository = repositoryStub();
        const meterAccess = meterAccessStub();
        const service = serviceWith(repository, meterAccess);

        await service.listReadings(METER_ID, 10, 0, undefined, REQUEST_STUB);

        expect(meterAccess.getMeter).toHaveBeenCalledWith(METER_ID);
        expect(repository.findByMeterId).toHaveBeenCalled();
    });

    it('does not list history when the meter is not accessible', async () => {
        const repository = repositoryStub();
        const meterAccess = meterAccessStub();
        meterAccess.getMeter = vi.fn().mockRejectedValue(new MeterNotFoundException(METER_ID));
        const service = serviceWith(repository, meterAccess);

        await expect(service.listReadings(METER_ID, undefined, undefined, undefined, REQUEST_STUB)).rejects.toBeInstanceOf(MeterNotFoundException);
        expect(repository.findByMeterId).not.toHaveBeenCalled();
    });

    it('verifies meter access before returning the latest reading', async () => {
        const repository = repositoryStub();
        const meterAccess = meterAccessStub();
        const service = serviceWith(repository, meterAccess);

        await service.getLatestReading(METER_ID, undefined, REQUEST_STUB);

        expect(meterAccess.getMeter).toHaveBeenCalledWith(METER_ID);
    });

    it('rejects a submission from a VIEWER with FORBIDDEN_ROLE', async () => {
        const repository = repositoryStub();
        const householdAccess = householdStub({member: true, role: 'VIEWER'});
        const service = serviceWith(repository, meterAccessStub(), idempotencyKeyStub(), householdAccess);

        await expect(service.createReading({meterId: METER_ID, value: 1, recordedAt: '2026-08-27T08:30:00Z'}, undefined, undefined, REQUEST_STUB))
            .rejects.toBeInstanceOf(ForbiddenRoleException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a submission from a non-member with the meter 404 mask', async () => {
        const repository = repositoryStub();
        const householdAccess = householdStub({member: false});
        const service = serviceWith(repository, meterAccessStub(), idempotencyKeyStub(), householdAccess);

        await expect(service.createReading({meterId: METER_ID, value: 1, recordedAt: '2026-08-27T08:30:00Z'}, undefined, undefined, REQUEST_STUB))
            .rejects.toBeInstanceOf(MeterNotFoundException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('fails a submission closed when household-service is unreachable', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository, meterAccessStub(), idempotencyKeyStub(), householdDownStub());

        await expect(service.createReading({meterId: METER_ID, value: 1, recordedAt: '2026-08-27T08:30:00Z'}, undefined, undefined, REQUEST_STUB))
            .rejects.toBeInstanceOf(HouseholdServiceUnavailableException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('lets a VIEWER read the reading history (reads need no household verdict)', async () => {
        const repository = repositoryStub();
        const householdAccess = householdStub({member: false});
        const service = serviceWith(repository, meterAccessStub(), idempotencyKeyStub(), householdAccess);

        const page = await service.listReadings(METER_ID, undefined, undefined, undefined, REQUEST_STUB);
        const latest = await service.getLatestReading(METER_ID, undefined, REQUEST_STUB);

        expect(page.items).toHaveLength(1);
        expect(latest.id).toBe(SAVED.id);
        expect(householdAccess.assertCanWrite).not.toHaveBeenCalled();
    });

    it('accepts the first reading for a meter (no previous to compare)', async () => {
        const repository = repositoryStub();
        repository.findPrevious = vi.fn().mockResolvedValue(null);
        const service = serviceWith(repository);

        const reading = await service.createReading({meterId: METER_ID, value: 5, recordedAt: '2026-08-01T08:00:00Z'}, undefined, undefined, REQUEST_STUB);

        expect(reading.value).toBe(15432.1);
        expect(repository.save).toHaveBeenCalled();
    });

    it('accepts an equal reading for a cumulative meter', async () => {
        const repository = repositoryStub();
        repository.findPrevious = vi.fn().mockResolvedValue({...SAVED, value: 15432.1});
        const service = serviceWith(repository);

        const reading = await service.createReading({meterId: METER_ID, value: 15432.1, recordedAt: '2026-08-02T08:00:00Z'}, undefined, undefined, REQUEST_STUB);

        expect(reading.value).toBe(15432.1);
        expect(repository.save).toHaveBeenCalled();
    });

    it('accepts an increasing reading for a cumulative meter', async () => {
        const repository = repositoryStub();
        repository.findPrevious = vi.fn().mockResolvedValue({...SAVED, value: 100});
        const service = serviceWith(repository);

        const reading = await service.createReading({meterId: METER_ID, value: 150.5, recordedAt: '2026-08-02T08:00:00Z'}, undefined, undefined, REQUEST_STUB);

        expect(reading.value).toBe(15432.1);
        expect(repository.save).toHaveBeenCalled();
    });

    it('rejects a decreasing reading with a stable business error', async () => {
        const repository = repositoryStub();
        repository.findPrevious = vi.fn().mockResolvedValue({
            ...SAVED,
            value: 150,
            recordedAt: '2026-08-01T08:00:00.000Z',
        });
        const service = serviceWith(repository);

        await expect(service.createReading({meterId: METER_ID, value: 100, recordedAt: '2026-08-02T08:00:00Z'}, undefined, undefined, REQUEST_STUB))
            .rejects.toBeInstanceOf(ReadingDecreasingException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('compares only readings recorded before the new one', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await service.createReading({meterId: METER_ID, value: 100, recordedAt: '2026-08-02T08:00:00Z'}, undefined, undefined, REQUEST_STUB);

        expect(repository.findPrevious).toHaveBeenCalledWith(METER_ID, new Date('2026-08-02T08:00:00Z'));
    });
});
