import { ReadingSource } from './reading-source.js';


export interface Reading { 
  /**
   * UUID v4 in canonical lowercase form.
   */
  id: string;
  /**
   * The meter this reading belongs to.
   */
  meterId: string;
  /**
   * Meter counter value at recording time; non-negative (PRD §7).
   */
  value: number;
  /**
   * RFC 3339 timestamp in UTC. Must use the Z suffix.
   */
  recordedAt: string;
  source: ReadingSource;
  /**
   * RFC 3339 timestamp in UTC. Must use the Z suffix.
   */
  createdAt: string;
}
export namespace Reading {
}


