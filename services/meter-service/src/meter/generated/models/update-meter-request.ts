import { MeterUnit } from './meter-unit.js';
import { MeterStatus } from './meter-status.js';


export interface UpdateMeterRequest { 
  /**
   * Display name of the meter.
   */
  name?: string;
  /**
   * Manufacturer serial number of the meter.
   */
  serialNumber?: string;
  unit?: MeterUnit;
  status?: MeterStatus;
}
export namespace UpdateMeterRequest {
}


