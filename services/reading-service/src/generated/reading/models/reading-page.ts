import { Reading } from './reading.js';


/**
 * Offset-based page of readings with a total count. `limit` and `offset` echo the server-applied values after clamping, so clients can rely on them to build the next request.
 */
export interface ReadingPage { 
  /**
   * The page of readings, newest first. Empty when the offset is past the end.
   */
  items: Array<Reading>;
  /**
   * Total number of readings for the meter, across all pages.
   */
  total: number;
  /**
   * Server-applied page size after clamping.
   */
  limit: number;
  /**
   * Server-applied number of skipped readings.
   */
  offset: number;
}

