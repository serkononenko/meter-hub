import {Injectable} from "@nestjs/common";

/** How long a verdict may be reused across requests (contract: ~30 s). */
export const VERDICT_TTL_MS = 30_000;

export interface CachedVerdict {
    expiresAt: number;
    member: boolean;
    role?: string;
}

/**
 * Process-wide store for household-access verdicts, keyed by
 * `householdId:userId`. Lives outside the request scope so verdicts survive
 * across requests; entries go stale after the TTL and are simply re-fetched
 * then. Bounded in practice by the number of (user, household) pairs seen
 * since startup; no eviction beyond staleness is needed for this service's
 * traffic profile.
 */
@Injectable()
export class VerdictCache {
    private readonly entries = new Map<string, CachedVerdict>();

    get(householdId: string, userId: string): CachedVerdict | undefined {
        const cached = this.entries.get(key(householdId, userId));

        if (cached && cached.expiresAt > Date.now()) {
            return cached;
        }

        return undefined;
    }

    put(householdId: string, userId: string, member: boolean, role?: string): CachedVerdict {
        const fresh: CachedVerdict = {
            expiresAt: Date.now() + VERDICT_TTL_MS,
            member,
            role,
        };
        this.entries.set(key(householdId, userId), fresh);
        return fresh;
    }

    /** Drops every cached verdict; used by tests to force cold lookups. */
    clear(): void {
        this.entries.clear();
    }
}

function key(householdId: string, userId: string): string {
    return `${householdId}:${userId}`;
}
