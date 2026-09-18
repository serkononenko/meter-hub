import { MeterType } from './meter-type.js';
import { MeterUnit } from './meter-unit.js';


export interface CreateMeterRequest { 
  /**
   * Household the meter belongs to. Must be owned by the authenticated user.
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
}
export namespace CreateMeterRequest {
}


