import { Inject, Injectable } from '@nestjs/common';
import {
  HouseholdAccessPort,
  HouseholdAccessException,
} from './household-access.port.js';
import { CORRELATION_ID_HEADER } from '../correlation/correlation.middleware.js';
import { CURRENT_CORRELATION_ID } from '../correlation/correlation.context.js';
import { HOUSEHOLD_ACCESS_CONFIG } from './household-access.tokens.js';
import type { HouseholdAccessConfig } from './household-access.config.js';

/**
 * HTTP adapter for {@link HouseholdAccessPort}: asks the household service
 * whether the caller owns the household, propagating the caller's access
 * token so the check runs under the caller's identity (identity propagation,
 * service-boundaries §Identity Propagation) and the correlation id so the two
 * hops share one trace.
 *
 * Fails closed: any answer other than 200/404 — an unexpected status, an
 * unreachable service, a timeout — raises {@link HouseholdAccessException}
 * rather than being read as "no such household", so a household-service
 * outage can never widen access to meters.
 */
@Injectable()
export class HttpHouseholdAccessClient implements HouseholdAccessPort {
  constructor(
    @Inject(HOUSEHOLD_ACCESS_CONFIG) private readonly config: HouseholdAccessConfig,
  ) {}

  async canAccess(householdId: string, accessToken: string): Promise<boolean> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/api/v1/households/${householdId}`, {
        method: 'GET',
        headers: this.headers(accessToken),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw new HouseholdAccessException(
        `Household service did not answer for household ${householdId}`,
        error,
      );
    }

    if (response.status === 200) {
      return true;
    }
    if (response.status === 404) {
      // The household service scopes lookups to the caller, so 404 means the
      // household is unknown or owned by somebody else. Draining the body
      // lets the connection be reused.
      await response.body?.cancel();
      return false;
    }
    throw new HouseholdAccessException(
      `Household service answered ${response.status} for household ${householdId}`,
    );
  }

  private headers(accessToken: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };
    const correlationId = CURRENT_CORRELATION_ID.getStore();
    if (correlationId) {
      headers[CORRELATION_ID_HEADER] = correlationId;
    }
    return headers;
  }
}
