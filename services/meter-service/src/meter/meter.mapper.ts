import type { Meter } from './meter.model.js';

/**
 * RFC 3339 UTC with `Z` suffix (api-conventions §3). Prisma returns
 * TIMESTAMPTZ columns as Date objects already in UTC.
 */
function toTimestamp(date: Date): string {
  return date.toISOString();
}

export interface MeterDto {
  id: string;
  householdId: string;
  type: string;
  name: string;
  serialNumber: string;
  unit: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function toMeterDto(meter: Meter): MeterDto {
  return {
    id: meter.id,
    householdId: meter.householdId,
    type: meter.type,
    name: meter.name,
    serialNumber: meter.serialNumber,
    unit: meter.unit,
    status: meter.status,
    createdAt: toTimestamp(meter.createdAt),
    updatedAt: toTimestamp(meter.updatedAt),
  };
}
