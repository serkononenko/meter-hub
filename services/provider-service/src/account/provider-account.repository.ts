import {Injectable} from '@nestjs/common';
import {PrismaService} from '../database/prisma.service.js';
import {Prisma} from '../generated/prisma/client.js';
import {toAccount} from './account.mapper.js';

import type {ProviderAccount, SubmissionRule} from '../generated/provider/models/index.js';


export interface NewAccount {
    id: string;
    providerId: string;
    householdId: string;
    label: string;
    accountNumber?: string;
    rule: SubmissionRule;
    actorId: string;
}

export interface AccountChanges {
    label?: string;
    accountNumber?: string;
    rule?: SubmissionRule;
    providerId?: string;
    archivedAt?: Date | null;
    actorId: string;
}

export interface AccountFilter {
    householdId: string;
    providerId?: string;
    includeArchived: boolean;
}

@Injectable()
export class ProviderAccountRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async save(account: NewAccount, tx?: Prisma.TransactionClient): Promise<ProviderAccount> {
        const row = await (tx ?? this.prisma).providerAccount.create({
            data: {
                id: account.id,
                providerId: account.providerId,
                householdId: account.householdId,
                label: account.label,
                accountNumber: account.accountNumber,
                rule: account.rule as unknown as Prisma.InputJsonValue,
                createdBy: account.actorId,
                updatedBy: account.actorId,
            },
        });
        return toAccount(row);
    }

    async findById(id: string, tx?: Prisma.TransactionClient): Promise<ProviderAccount | null> {
        const row = await (tx ?? this.prisma).providerAccount.findUnique({where: {id}});
        return row ? toAccount(row) : null;
    }

    async findByFilter(filter: AccountFilter): Promise<ProviderAccount[]> {
        const rows = await this.prisma.providerAccount.findMany({
            where: {
                householdId: filter.householdId,
                ...(filter.providerId ? {providerId: filter.providerId} : {}),
                ...(filter.includeArchived ? {} : {archivedAt: null}),
            },
            orderBy: {createdAt: 'asc'},
        });
        return rows.map(toAccount);
    }

    async lockById(id: string, tx: Prisma.TransactionClient): Promise<ProviderAccount | null> {
        await tx.$queryRaw`SELECT id FROM provider_accounts WHERE id = ${id}::uuid FOR UPDATE`;
        return this.findById(id, tx);
    }

    async update(id: string, changes: AccountChanges, tx: Prisma.TransactionClient): Promise<ProviderAccount> {
        const {actorId, rule, ...rest} = changes;

        const row = await tx.providerAccount.update({
            where: {id},
            data: {
                ...rest,
                ...(rule ? {rule: rule as unknown as Prisma.InputJsonValue} : {}),
                version: {increment: 1},
                updatedBy: actorId,
            },
        });
        return toAccount(row);
    }

    async countBindingsInEffect(accountId: string, today: Date, tx: Prisma.TransactionClient): Promise<number> {
        return tx.meterBinding.count({
            where: {accountId, OR: [{validTo: null}, {validTo: {gte: today}}]},
        });
    }
}
