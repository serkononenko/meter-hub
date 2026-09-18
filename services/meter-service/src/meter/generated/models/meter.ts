import { MeterType } from './meter-type.js';
import { MeterUnit } from './meter-unit.js';
import { MeterStatus } from './meter-status.js';


export interface Meter { 
  /**
   * UUID v4 in canonical lowercase form.
   */
  id: string;
  /**
   * Household the meter belongs to.
   */
  householdId: string;
  type: MeterType;
  /**
   * Display name of the meter.
   */
  name: string;
  /**
   * Manufacturer serial number of the meter.
   */
  serialNumber: string;
  unit: MeterUnit;
  status: MeterStatus;
  /**
   * RFC 3339 timestamp in UTC. Must use the Z suffix.
   */
  createdAt: string;
  /**
   * RFC 3339 timestamp in UTC. Must use the Z suffix.
   */
  updatedAt: string;
}
export namespace Meter {
}


