import { DayKind } from './day-kind.js';


/**
 * A day within the cycle month. DAY_OF_MONTH uses `day` (days beyond the month\'s length clamp to its last day); LAST_DAY counts back from the last day of the month by `offsetDays` (default 0).
 */
export interface DaySpec { 
  kind: DayKind;
  /**
   * Required for DAY_OF_MONTH, ignored for LAST_DAY.
   */
  day?: number;
  /**
   * Used by LAST_DAY (default 0), ignored for DAY_OF_MONTH.
   */
  offsetDays?: number;
}
export namespace DaySpec {
}


