import {Injectable, Scope} from "@nestjs/common";
import {FetchError, InternalApi} from '../generated/household/index.js';
import {VerdictCache} from './verdict-cache.js';
import {HouseholdServiceUnavailableException} from '../exceptions/service-unavailable.exception.js';
import {ForbiddenRoleException} from '../exceptions/forbidden.exception.js';
import {HouseholdNotFoundException} from "../exceptions/not-found.exception.js";

import type {CachedVerdict} from './verdict-cache.js';


const WRITE_ROLES = new Set(['OWNER', 'MEMBER']);

@Injectable({scope: Scope.REQUEST})
export class HouseholdAccessService {
    constructor(
        private readonly internalApi: InternalApi,
        private readonly cache: VerdictCache,
    ) {
    }

    async assertCanRead(householdId: string, userId: string): Promise<void> {
        const verdict = await this.verdict(householdId, userId);

        if (!verdict.member) {
            throw new HouseholdNotFoundException(householdId);
        }
    }

    async assertCanWrite(householdId: string, userId: string): Promise<void> {
        const verdict = await this.verdict(householdId, userId);

        if (!verdict.member) {
            throw new HouseholdNotFoundException(householdId);
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
                throw new HouseholdServiceUnavailableException(error.cause);
            }

            throw error;
        }
    }
}
