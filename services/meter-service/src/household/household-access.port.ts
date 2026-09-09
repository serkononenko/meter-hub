/**
 * Outbound port for household-ownership checks (5.4).
 *
 * Meter-service cannot query household-db (no cross-service database access,
 * service-boundaries §Principles), so ownership is verified through the
 * household service's owner-scoped GET /api/v1/households/{id} endpoint: it
 * answers 200 for a household owned by the caller and 404 for one that is
 * unknown or belongs to somebody else — exactly the distinction the meter API
 * must surface.
 */
export interface HouseholdAccessPort {
  /**
   * Returns whether the household is visible to the holder of the access
   * token. `false` covers both unknown and foreign households; callers turn
   * both into the same enumeration-safe 404.
   */
  canAccess(householdId: string, accessToken: string): Promise<boolean>;
}

/** The household service could not be reached or answered unexpectedly. */
export class HouseholdAccessException extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'HouseholdAccessException';
  }
}
