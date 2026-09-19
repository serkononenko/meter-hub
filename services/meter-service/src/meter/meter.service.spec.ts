import {describe, expect, it, vi} from 'vitest';
import {MeterService} from './meter.service.js';
import {MeterRepository} from './meter.repository.js';
import {HouseholdService} from '../household/household.service.js';
import {MeterNotFoundException} from '../exceptions/not-found.exception.js';
import {HouseholdServiceUnavailableException} from '../exceptions/service-unavailable.exception.js';
import {MeterType, MeterUnit, MeterStatus} from "./generated/models/index.js";

import type {Meter} from "./generated/models/index.js";


const HOUSEHOLD = '3f6a5b7c-93d2-4c8e-9a44-9f60f1f4c2aa';
const METER: Meter = {
    id: '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01',
    householdId: HOUSEHOLD,
    type: MeterType.ELECTRICITY,
    name: 'Main electricity meter',
    serialNumber: 'EL-123456',
    unit: MeterUnit.KWH,
    status: MeterStatus.ACTIVE,
    createdAt: '2026-09-09T10:00:00Z',
    updatedAt: '2026-09-09T10:00:00Z',
};

function repositoryStub(): MeterRepository {
    return {
        save: vi.fn().mockResolvedValue(METER),
        findById: vi.fn().mockResolvedValue(METER),
        findByHouseholdId: vi.fn().mockResolvedValue([METER]),
        update: vi.fn().mockResolvedValue(METER),
    } as unknown as MeterRepository;
}

/** Stub household port: every test household resolves (access granted). */
function householdStub(): HouseholdService {
    return {
        getHousehold: vi.fn().mockResolvedValue({id: HOUSEHOLD}),
    } as unknown as HouseholdService;
}

/** Stub household port that always fails (service unreachable). */
function householdDownStub(): HouseholdService {
    return {
        getHousehold: vi.fn().mockRejectedValue(new HouseholdServiceUnavailableException()),
    } as unknown as HouseholdService;
}

function serviceWith(repository: MeterRepository, household: HouseholdService = householdStub()) {
    return new MeterService(repository, household);
}

describe('MeterService', () => {
    it('persists meters through the repository when the household is accessible', async () => {
        const repository = repositoryStub();
        const household = householdStub();
        const service = serviceWith(repository, household);

        const created = await service.createMeter({
            householdId: HOUSEHOLD,
            type: METER.type,
            name: METER.name as string,
            serialNumber: METER.serialNumber,
            unit: METER.unit,
        });

        expect(household.getHousehold).toHaveBeenCalledWith(HOUSEHOLD);
        expect(repository.save).toHaveBeenCalledWith(
            expect.objectContaining({householdId: HOUSEHOLD, serialNumber: METER.serialNumber}),
        );
        expect(created.id).toBe(METER.id);
    });

    it('refuses to create a meter in an inaccessible household', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository, householdDownStub());

        await expect(service.createMeter({
            householdId: HOUSEHOLD,
            type: METER.type,
            name: METER.name as string,
            serialNumber: METER.serialNumber,
            unit: METER.unit,
        })).rejects.toBeInstanceOf(HouseholdServiceUnavailableException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('lists meters only after the household check passes', async () => {
        const repository = repositoryStub();
        const household = householdStub();
        const service = serviceWith(repository, household);

        const meters = await service.listMeters(HOUSEHOLD);

        expect(household.getHousehold).toHaveBeenCalledWith(HOUSEHOLD);
        expect(repository.findByHouseholdId).toHaveBeenCalledWith(HOUSEHOLD);
        expect(meters).toHaveLength(1);
    });

    it('refuses listing meters of an inaccessible household', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository, householdDownStub());

        await expect(service.listMeters(HOUSEHOLD)).rejects.toBeInstanceOf(HouseholdServiceUnavailableException);
        expect(repository.findByHouseholdId).not.toHaveBeenCalled();
    });

    it('returns a meter whose household is accessible', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        const meter = await service.getMeter(METER.id);

        expect(meter.id).toBe(METER.id);
    });

    it('throws when a meter is not found', async () => {
        const repository = repositoryStub();
        repository.findById = vi.fn().mockResolvedValue(null);
        const service = serviceWith(repository);

        await expect(service.getMeter(METER.id)).rejects.toBeInstanceOf(MeterNotFoundException);
    });

    it('applies only provided changes on update', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository);

        await service.updateMeter(METER.id, {status: 'ARCHIVED'});

        expect(repository.update).toHaveBeenCalledWith(METER.id, {status: 'ARCHIVED'});
    });

    it('refuses updating a meter that does not exist', async () => {
        const repository = repositoryStub();
        repository.update = vi.fn().mockResolvedValue(null);
        const service = serviceWith(repository);

        await expect(service.updateMeter(METER.id, {status: 'ARCHIVED'})).rejects.toBeInstanceOf(MeterNotFoundException);
    });

    it('fails closed when the household service is unreachable', async () => {
        const repository = repositoryStub();
        const service = serviceWith(repository, householdDownStub());

        await expect(service.createMeter({
            householdId: HOUSEHOLD,
            type: METER.type,
            name: METER.name as string,
            serialNumber: METER.serialNumber,
            unit: METER.unit,
        })).rejects.toBeInstanceOf(HouseholdServiceUnavailableException);
        expect(repository.save).not.toHaveBeenCalled();
    });
});
