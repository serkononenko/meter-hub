import { describe, expect, it, vi } from 'vitest';
import { MeterType } from '../database/generated/prisma/enums.js';
import { MeterService } from './meter.service.js';
import type { Meter, MeterRepository } from './meter.repository.js';

const METER: Meter = {
  id: '0d7f8a26-6f6f-4a55-9a71-3bd11c0a1f01',
  householdId: '3f6a5b7c-93d2-4c8e-9a44-9f60f1f4c2aa',
  type: MeterType.ELECTRICITY,
  name: 'Main electricity meter',
  serialNumber: 'EL-123456',
  unit: 'KWH',
  status: 'ACTIVE',
  createdAt: new Date('2026-09-09T10:00:00Z'),
  updatedAt: new Date('2026-09-09T10:00:00Z'),
};

function repositoryStub(): MeterRepository {
  return {
    save: vi.fn().mockResolvedValue(METER),
    findById: vi.fn().mockResolvedValue(METER),
    findByHouseholdId: vi.fn().mockResolvedValue([METER]),
    update: vi.fn().mockResolvedValue(METER),
  };
}

function serviceWith(repository: MeterRepository) {
  return new MeterService(repository);
}

describe('MeterService', () => {
  it('persists meters through the repository', async () => {
    const repository = repositoryStub();
    const service = serviceWith(repository);

    const created = await service.create(METER);

    expect(repository.save).toHaveBeenCalledWith(METER);
    expect(created.id).toBe(METER.id);
  });

  it('lists meters of a household through the repository', async () => {
    const repository = repositoryStub();
    const service = serviceWith(repository);

    const meters = await service.listByHousehold(METER.householdId);

    expect(repository.findByHouseholdId).toHaveBeenCalledWith(METER.householdId);
    expect(meters).toHaveLength(1);
  });

  it('throws when a meter is not found', async () => {
    const repository = repositoryStub();
    repository.findById = vi.fn().mockResolvedValue(null);
    const service = serviceWith(repository);

    await expect(service.getById(METER.id)).rejects.toMatchObject({
      name: 'NotFoundException',
    });
  });

  it('applies only provided changes on update', async () => {
    const repository = repositoryStub();
    const service = serviceWith(repository);

    await service.update(METER.id, { status: 'ARCHIVED' });

    expect(repository.update).toHaveBeenCalledWith(METER.id, { status: 'ARCHIVED' });
  });

  it('throws on update when the meter does not exist', async () => {
    const repository = repositoryStub();
    repository.update = vi.fn().mockResolvedValue(null);
    const service = serviceWith(repository);

    await expect(service.update(METER.id, { status: 'ARCHIVED' })).rejects.toMatchObject({
      name: 'NotFoundException',
    });
  });
});
