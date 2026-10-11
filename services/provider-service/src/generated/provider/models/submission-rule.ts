import { SubmissionCycle } from './submission-cycle.js';
import { DaySpec } from './day-spec.js';


/**
 * When readings are due. The window opens at 00:00 on the opening day and closes at the end of the closing day, both in `timezone`. If the closing day falls before the opening day it is the next month\'s.
 */
export interface SubmissionRule { 
  cycle: SubmissionCycle;
  opens: DaySpec;
  closes: DaySpec;
  /**
   * IANA time zone name.
   */
  timezone: string;
}
export namespace SubmissionRule {
}


