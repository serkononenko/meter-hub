import {describe, expect, it, vi} from 'vitest';
import {MeterType} from '../database/generated/prisma/enums.js';
import {MeterService} from './meter.service.js';
import {MeterRepository} from './meter.repository.js';
import {HouseholdAccessException} from '../exceptions/household-access.exception.js';
import type {Meter} from "./generated/models/index.js";

const ALICE_TOKEN = 'alice-token';
const BOB_TOKEN = 'bob-token';

const HOUSEHOLD = '3f6a5b7c-93d2-4c8e-9a44-9f60f1f4c2aa';
const METER: Meter = {
    id: '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01',
    householdId: HOUSEHOLD,
    type: MeterType.ELECTRICITY,
    name: 'Main electricity meter',
    serialNumber: 'EL-123456',
    unit: 'KWH',
    status: 'ACTIVE',
    createdAt: '2026-09-09T10:00:00Z',
    updatedAt: '2026-09-09T10:00:00Z',
};

function repositoryStub(): typeof MeterRepository {
    return {
        save: vi.fn().mockResolvedValue(METER),
        findById: vi.fn().mockResolvedValue(METER),
        findByHouseholdId: vi.fn().mockResolvedValue([METER]),
        update: vi.fn().mockResolvedValue(METER),
    };
}

/** Stub ownership port: Alice owns the test household, Bob does not. */
function accessStub(overrides: Partial<HouseholdAccessException> = {}): HouseholdAccessException {
    return {
        canAccess: vi.fn(async (_householdId: string, token: string) => token === ALICE_TOKEN),
        ...overrides,
    };
}

function serviceWith(repository: MeterRepository, access = accessStub()) {
    return new MeterService(repository, access);
}

describe('MeterService', () => {
    it('persists meters through the repository when the household is owned', async () => {
        const repository = repositoryStub();
        const access = accessStub();
        const service = serviceWith(repository, access);

        const created = await service.create(METER, ALICE_TOKEN);

        expect(access.canAccess).toHaveBeenCalledWith(HOUSEHOLD, ALICE_TOKEN);
        expect(repository.save).toHaveBeenCalledWith(METER);
        expect(created.id).toBe(METER.id);
    });

    it('refuses to create a meter in a household the caller cannot see', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.create(METER, BOB_TOKEN)).rejects.toMatchObject({
            response: {code: 'HOUSEHOLD_NOT_FOUND'}, status: 404,
        });
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('treats unknown and foreign households the same (404)', async () => {
        const repository = repositoryStub();
        const access = accessStub({canAccess: vi.fn().mockResolvedValue(false)});
        const service = serviceWith(repository, access);

        await expect(service.create(METER, ALICE_TOKEN)).rejects.toMatchObject({
            response: {code: 'HOUSEHOLD_NOT_FOUND'}, status: 404,
        });
    });

    it('lists meters only after the household check passes', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        const meters = await service.listByHousehold(HOUSEHOLD, ALICE_TOKEN);

        expect(repository.findByHouseholdId).toHaveBeenCalledWith(HOUSEHOLD);
        expect(meters).toHaveLength(1);
    });

    it('refuses listing meters of a foreign household', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.listByHousehold(HOUSEHOLD, BOB_TOKEN)).rejects.toMatchObject({
            response: {code: 'HOUSEHOLD_NOT_FOUND'}, status: 404,
        });
        expect(repository.findByHouseholdId).not.toHaveBeenCalled();
    });

    it('returns a meter whose household belongs to the caller', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        const meter = await service.getById(METER.id, ALICE_TOKEN);

        expect(meter.id).toBe(METER.id);
    });

    it('hides a foreign-owned meter behind the same 404 as an unknown meter', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        // The meter exists but Bob does not own its household: indistinguishable
        // from a missing meter so ids cannot be probed.
        await expect(service.getById(METER.id, BOB_TOKEN)).rejects.toMatchObject({
            name: 'NotFoundException',
        });
    });

    it('throws when a meter is not found', async () => {
        const repository = repositoryStub();
        repository.findById = vi.fn().mockResolvedValue(null);
        const service = serviceWith(repository);

        await expect(service.getById(METER.id, ALICE_TOKEN)).rejects.toMatchObject({
            name: 'NotFoundException',
        });
    });

    it('applies only provided changes on update', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await service.update(METER.id, {status: 'ARCHIVED'}, ALICE_TOKEN);

        expect(repository.update).toHaveBeenCalledWith(METER.id, {status: 'ARCHIVED'});
    });

    it('refuses updating a meter owned by another user', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await expect(service.update(METER.id, {status: 'ARCHIVED'}, BOB_TOKEN)).rejects.toMatchObject({
            name: 'NotFoundException',
        });
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('throws on update when the meter does not exist', async () => {
        const repository = repositoryStub();
        repository.update = vi.fn().mockResolvedValue(null);
        const service = serviceWith(repository);

        await expect(service.update(METER.id, {status: 'ARCHIVED'}, ALICE_TOKEN)).rejects.toMatchObject({
            name: 'NotFoundException',
        });
    });

    it('fails closed with 502 when the household service is unreachable', async () => {
        const repository = repositoryStub();
        const access = accessStub({
            canAccess: vi.fn().mockRejectedValue(new HouseholdAccessException('down')),
        });
        const service = serviceWith(repository, access);

        await expect(service.create(METER, ALICE_TOKEN)).rejects.toMatchObject({
            response: {code: 'HOUSEHOLD_SERVICE_UNAVAILABLE'}, status: 502,
        });
        expect(repository.save).not.toHaveBeenCalled();
    });
});
