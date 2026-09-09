import { MeterStatus, MeterType, MeterUnit } from '../database/generated/prisma/enums.js';

export { MeterStatus, MeterType, MeterUnit };

/**
 * A physical utility meter registered under a household.
 *
 * `householdId` references a household owned by Household Service; ownership
 * of that reference is validated at the API boundary, not via a database
 * foreign key (no cross-service database access).
 */
export interface Meter {
  id: string;
  householdId: string;
  type: MeterType;
  name: string;
  serialNumber: string;
  unit: MeterUnit;
  status: MeterStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const METER_TYPES = Object.values(MeterType) as MeterType[];

export const METER_UNITS = Object.values(MeterUnit) as MeterUnit[];

export const METER_STATUSES = Object.values(MeterStatus) as MeterStatus[];
