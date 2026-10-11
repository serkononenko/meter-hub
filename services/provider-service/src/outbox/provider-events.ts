import {randomUUID} from 'node:crypto';

import type {ProviderAccountChanged} from '../generated/events/account-changed.v1.schema.js';
import type {ProviderBindingChanged} from '../generated/events/binding-changed.v1.schema.js';
import type {MeterBinding, ProviderAccount} from '../generated/provider/models/index.js';


export const ACCOUNT_CHANGED_TOPIC = 'provider.account.changed';
export const BINDING_CHANGED_TOPIC = 'provider.binding.changed';

export function accountChanged(account: ProviderAccount): ProviderAccountChanged {
    return {
        eventId: randomUUID(),
        eventType: ACCOUNT_CHANGED_TOPIC,
        eventVersion: 1,
        occurredAt: account.updatedAt,
        producer: 'provider-service',
        data: {
            accountId: account.id,
            providerId: account.providerId,
            householdId: account.householdId,
            version: account.version,
            rule: account.rule,
            archived: account.archived,
        },
    };
}

export function bindingChanged(binding: MeterBinding): ProviderBindingChanged {
    return {
        eventId: randomUUID(),
        eventType: BINDING_CHANGED_TOPIC,
        eventVersion: 1,
        occurredAt: binding.updatedAt,
        producer: 'provider-service',
        data: {
            bindingId: binding.id,
            accountId: binding.accountId,
            householdId: binding.householdId,
            meterId: binding.meterId,
            validFrom: binding.validFrom,
            validTo: binding.validTo ?? null,
            version: binding.version,
        },
    };
}
