import {Injectable, Scope} from "@nestjs/common";
import {FetchError, InternalApi} from './generated/index.js';
import {HouseholdServiceUnavailableException} from '../exceptions/service-unavailable.exception.js';
import {ForbiddenRoleException} from '../exceptions/forbidden-role.exception.js';
import {VerdictCache, type CachedVerdict} from './verdict-cache.js';

/**
 * Roles that may create/modify meters (A3): MEMBER and OWNER qualify;
 * VIEWER is read-only. Kept local — the role vocabulary is owned by
 * household-service, this only compares it.
 */
const WRITE_ROLES = new Set(['OWNER', 'MEMBER']);

/**
 * Role-aware authorization for the meter path. Asks household-service's
 * internal access verdict for the caller's (household, user) pair and caches
 * it briefly in-process (see {@link VerdictCache}) so membership lookups
 * don't repeat per meter read within the TTL. The cache is best-effort on
 * purpose: membership changes (invite, removal) take up to the TTL to bite,
 * and stale-allow for that window is the accepted trade-off (spec A3 §11).
 * Household-service being unreachable fails closed with 503, matching the
 * existence check this replaces.
 *
 * Request-scoped because the internal API reads the caller's token off the
 * request; the verdict cache it uses is a singleton.
 */
@Injectable({scope: Scope.REQUEST})
export class HouseholdAccessService {
    constructor(
        private readonly internalApi: InternalApi,
        private readonly cache: VerdictCache,
    ) {
    }

    /**
     * Any membership role may read. No membership surfaces as the same 404
     * the old existence check produced, keeping non-member masking intact.
     */
    async assertCanRead(householdId: string, userId: string): Promise<void> {
        const verdict = await this.verdict(householdId, userId);

        if (!verdict.member) {
            throw new NotFoundMaskedError(householdId);
        }
    }

    /**
     * Only MEMBER and above may write; VIEWER gets 403 FORBIDDEN_ROLE,
     * non-members keep the 404 mask.
     */
    async assertCanWrite(householdId: string, userId: string): Promise<void> {
        const verdict = await this.verdict(householdId, userId);

        if (!verdict.member) {
            throw new NotFoundMaskedError(householdId);
        }

        if (verdict.role === undefined || !WRITE_ROLES.has(verdict.role)) {
            throw new ForbiddenRoleException(verdict.role ?? 'UNKNOWN', 'creating or modifying meters');
        }
    }

    private async verdict(householdId: string, userId: string): Promise<CachedVerdict> {
        const cached = this.cache.get(householdId, userId);

        if (cached) {
            return cached;
        }

        try {
            const access = await this.internalApi.getHouseholdAccess({householdId, userId});
            return this.cache.put(householdId, userId, access._exists, access.role);
        } catch (error) {
            if (error instanceof FetchError) {
                // Fail closed: without a verdict nothing is readable or
                // writable, same as the unreachable-household 503 today.
                throw new HouseholdServiceUnavailableException(error.cause);
            }

            throw error;
        }
    }
}

/**
 * Internal signal for "no membership" — translated to the enumeration-safe
 * 404 at the call site so the masking vocabulary stays in meter.service.ts.
 */
export class NotFoundMaskedError extends Error {
    constructor(householdId: string) {
        super(`no membership in household ${householdId}`);
    }
}
