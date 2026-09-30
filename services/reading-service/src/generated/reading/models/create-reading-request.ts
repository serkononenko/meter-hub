

export interface CreateReadingRequest { 
  /**
   * The meter the reading belongs to. Must be accessible to the authenticated user (any membership role in its household).
   */
  meterId: string;
  /**
   * Meter counter value at recording time; non-negative (PRD §7).
   */
  value: number;
  /**
   * When the reading was taken. RFC 3339 timestamp in UTC. Must use the Z suffix.
   */
  recordedAt: string;
}

