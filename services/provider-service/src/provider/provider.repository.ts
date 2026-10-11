import {Injectable} from '@nestjs/common';
import {PrismaService} from '../database/prisma.service.js';
import {Prisma} from '../generated/prisma/client.js';
import {ProviderScope} from '../generated/provider/models/index.js';

import type {Provider as ProviderRow} from '../generated/prisma/client.js';
import type {Provider, SubmissionRule} from '../generated/provider/models/index.js';


export interface NewProvider {
    id: string;
    householdId: string | null;
    name: string;
    notes?: string;
    defaultRule?: SubmissionRule;
    actorId: string;
}

export interface ProviderChanges {
    name?: string;
    notes?: string;
    defaultRule?: SubmissionRule;
    archivedAt?: Date | null;
    householdId?: null;
    actorId: string;
}

export interface ProviderFilter {
    householdId?: string;
    scope?: ProviderScope;
    includeArchived: boolean;
    /** Admin listing without a household: private providers are discoverable for promotion. */
    includeAllHouseholds?: boolean;
}

@Injectable()
export class ProviderRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async save(provider: NewProvider): Promise<Provider> {
        const row = await this.prisma.provider.create({
            data: {
                id: provider.id,
                householdId: provider.householdId,
                name: provider.name,
                notes: provider.notes,
                defaultRule: provider.defaultRule as unknown as Prisma.InputJsonValue | undefined,
                createdBy: provider.actorId,
                updatedBy: provider.actorId,
            },
        });
        return toProvider(row);
    }

    async findById(id: string): Promise<Provider | null> {
        const row = await this.prisma.provider.findUnique({where: {id}});
        return row ? toProvider(row) : null;
    }

    async findVisibleToHousehold(id: string, householdId: string): Promise<Provider | null> {
        const row = await this.prisma.provider.findFirst({
            where: {id, OR: [{householdId: null}, {householdId}]},
        });
        return row ? toProvider(row) : null;
    }

    async findVisible(filter: ProviderFilter): Promise<Provider[]> {
        const rows = await this.prisma.provider.findMany({
            where: {
                AND: [
                    visibilityClause(filter),
                    filter.includeArchived ? {} : {archivedAt: null},
                ],
            },
            orderBy: [{name: 'asc'}, {createdAt: 'asc'}],
        });
        return rows.map(toProvider);
    }

    async update(id: string, changes: ProviderChanges): Promise<Provider> {
        const {actorId, defaultRule, ...rest} = changes;

        const row = await this.prisma.provider.update({
            where: {id},
            data: {
                ...rest,
                ...(defaultRule !== undefined ? {defaultRule: defaultRule as unknown as Prisma.InputJsonValue} : {}),
                updatedBy: actorId,
            },
        });
        return toProvider(row);
    }
}

function visibilityClause({householdId, scope, includeAllHouseholds}: ProviderFilter): Prisma.ProviderWhereInput {
    if (includeAllHouseholds) {
        if (scope === ProviderScope.GLOBAL) {
            return {householdId: null};
        }
        if (scope === ProviderScope.HOUSEHOLD) {
            return {NOT: {householdId: null}};
        }
        return {};
    }

    if (scope === ProviderScope.GLOBAL || !householdId) {
        return {householdId: null};
    }

    if (scope === ProviderScope.HOUSEHOLD) {
        return {householdId};
    }

    return {OR: [{householdId: null}, {householdId}]};
}

function toProvider(row: ProviderRow): Provider {
    return {
        id: row.id,
        scope: row.householdId === null ? ProviderScope.GLOBAL : ProviderScope.HOUSEHOLD,
        householdId: row.householdId,
        name: row.name,
        notes: row.notes,
        ...(row.defaultRule ? {defaultRule: row.defaultRule as unknown as SubmissionRule} : {}),
        archived: row.archivedAt !== null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
