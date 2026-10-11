import { SubmissionWindow } from './submission-window.js';
import { MeterBinding } from './meter-binding.js';


/**
 * Empty when the meter has no binding at the requested time.
 */
export interface MeterSubmissionWindows { 
  binding?: MeterBinding;
  /**
   * The window containing the requested time. Absent when none is open.
   */
  current?: SubmissionWindow;
  next?: SubmissionWindow;
}

