import type {MeterBinding as BindingRow} from '../generated/prisma/client.js';
import type {MeterBinding} from '../generated/provider/models/index.js';


export function toBinding(row: BindingRow): MeterBinding {
    return {
        id: row.id,
        accountId: row.accountId,
        householdId: row.householdId,
        meterId: row.meterId,
        validFrom: formatDate(row.validFrom),
        validTo: row.validTo ? formatDate(row.validTo) : null,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

export function parseDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
}

export function formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}
