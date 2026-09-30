import {Injectable} from "@nestjs/common";


export const VERDICT_TTL_MS = 30_000;

export interface CachedVerdict {
    expiresAt: number;
    member: boolean;
    role?: string;
}

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

    clear(): void {
        this.entries.clear();
    }
}

function key(householdId: string, userId: string): string {
    return `${householdId}:${userId}`;
}
