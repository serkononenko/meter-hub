import type {ProviderAccount as AccountRow} from '../generated/prisma/client.js';
import type {ProviderAccount, SubmissionRule} from '../generated/provider/models/index.js';


export function toAccount(row: AccountRow): ProviderAccount {
    return {
        id: row.id,
        providerId: row.providerId,
        householdId: row.householdId,
        label: row.label,
        accountNumber: row.accountNumber,
        rule: row.rule as unknown as SubmissionRule,
        version: row.version,
        archived: row.archivedAt !== null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
