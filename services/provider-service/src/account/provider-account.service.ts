import {Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {randomUUID} from 'node:crypto';
import {TransactionManager} from '../database/transaction.manager.js';
import {AccountHasActiveBindingsException, ProviderArchivedException} from '../exceptions/unprocessable.exception.js';
import {
    HouseholdNotFoundException,
    ProviderAccountNotFoundException,
    ProviderNotFoundException,
} from '../exceptions/not-found.exception.js';
import {InvalidSubmissionRuleException} from '../exceptions/unprocessable.exception.js';
import {ProviderAccountsApi} from '../generated/provider/api/index.js';
import {HouseholdAccessService} from '../household/household-access.service.js';
import {ProviderRepository} from '../provider/provider.repository.js';
import {accountChanged} from '../outbox/provider-events.js';
import {OutboxRepository} from '../outbox/outbox.repository.js';
import {requireValidRule} from '../submission-window/require-valid-rule.js';
import {localDateOf} from '../submission-window/calendar.js';
import {sameRule} from '../submission-window/same-rule.js';
import {getAuthenticatedUser} from '../utils/get-authenticated-user.js';
import {parseBooleanQuery} from '../utils/parse-boolean-query.js';
import {requireUuid, optionalUuid} from '../validation/require-uuid.js';
import {validateCommand} from '../validation/validate-command.js';
import {CreateProviderAccountCommand} from './commands/create-provider-account.command.js';
import {UpdateProviderAccountCommand} from './commands/update-provider-account.command.js';
import {ProviderAccountRepository} from './provider-account.repository.js';

import type {
    CreateProviderAccountRequest,
    Provider,
    ProviderAccount,
    UpdateProviderAccountRequest,
} from '../generated/provider/models/index.js';
import type {AccountChanges} from './provider-account.repository.js';


@Injectable()
export class ProviderAccountService extends ProviderAccountsApi {
    constructor(
        private readonly transactions: TransactionManager,
        private readonly accounts: ProviderAccountRepository,
        private readonly providers: ProviderRepository,
        private readonly householdAccess: HouseholdAccessService,
        private readonly outbox: OutboxRepository,
    ) {
        super();
    }

    async createProviderAccount(
        payload: CreateProviderAccountRequest,
        _correlationId?: string,
        request?: Request,
    ): Promise<ProviderAccount> {
        const user = getAuthenticatedUser(request);
        const command = plainToInstance(CreateProviderAccountCommand, payload);
        await validateCommand(command);

        await this.householdAccess.assertCanWrite(command.householdId, user.userId);
        const provider = await this.chooseProvider(command.providerId, command.householdId);

        const rule = this.ruleForNewAccount(command, provider);

        return this.transactions.execute(async (tx) => {
            const created = await this.accounts.save({
                id: randomUUID(),
                providerId: provider.id,
                householdId: command.householdId,
                label: command.label,
                accountNumber: command.accountNumber,
                rule,
                actorId: user.userId,
            }, tx);
            await this.outbox.save(accountChanged(created), created.id, tx);
            return created;
        });
    }

    async listProviderAccounts(
        householdId: string,
        providerId?: string,
        includeArchived?: boolean,
        _correlationId?: string,
        request?: Request,
    ): Promise<ProviderAccount[]> {
        const user = getAuthenticatedUser(request);
        const household = requireUuid(householdId, 'householdId');
        await this.householdAccess.assertCanRead(household, user.userId);

        return this.accounts.findByFilter({
            householdId: household,
            providerId: optionalUuid(providerId, 'providerId'),
            includeArchived: parseBooleanQuery(includeArchived),
        });
    }

    async getProviderAccount(accountId: string, _correlationId?: string, request?: Request): Promise<ProviderAccount> {
        const user = getAuthenticatedUser(request);
        const account = await this.accounts.findById(requireUuid(accountId, 'accountId'));

        if (!account) {
            throw new ProviderAccountNotFoundException();
        }

        await this.assertMember(account.householdId, user.userId);
        return account;
    }

    async updateProviderAccount(
        accountId: string,
        payload: UpdateProviderAccountRequest,
        _correlationId?: string,
        request?: Request,
    ): Promise<ProviderAccount> {
        const user = getAuthenticatedUser(request);
        const command = plainToInstance(UpdateProviderAccountCommand, payload);
        await validateCommand(command);

        const id = requireUuid(accountId, 'accountId');
        const existing = await this.accounts.findById(id);

        if (!existing) {
            throw new ProviderAccountNotFoundException();
        }

        await this.assertMember(existing.householdId, user.userId);
        await this.householdAccess.assertCanWrite(existing.householdId, user.userId);

        const rule = command.rule ? requireValidRule(command.rule) : undefined;
        const provider = command.providerId && command.providerId !== existing.providerId
            ? await this.chooseProvider(command.providerId, existing.householdId)
            : undefined;

        return this.transactions.execute(async (tx) => {
            const current = await this.accounts.lockById(id, tx);

            if (!current) {
                throw new ProviderAccountNotFoundException();
            }

            const archiving = command.archived === true && !current.archived;
            if (archiving && await this.accounts.countBindingsInEffect(id, todayIn(current.rule.timezone), tx) > 0) {
                throw new AccountHasActiveBindingsException();
            }

            const changes: AccountChanges = {actorId: user.userId};
            let changed = false;

            if (command.label !== undefined && command.label !== current.label) {
                changes.label = command.label;
                changed = true;
            }
            if (command.accountNumber !== undefined && command.accountNumber !== (current.accountNumber ?? undefined)) {
                changes.accountNumber = command.accountNumber;
                changed = true;
            }
            if (rule && !sameRule(rule, current.rule)) {
                changes.rule = rule;
                changed = true;
            }
            if (provider) {
                changes.providerId = provider.id;
                changed = true;
            }
            if (command.archived !== undefined && command.archived !== current.archived) {
                changes.archivedAt = command.archived ? new Date() : null;
                changed = true;
            }

            if (!changed) {
                return current;
            }

            const updated = await this.accounts.update(id, changes, tx);
            await this.outbox.save(accountChanged(updated), updated.id, tx);
            return updated;
        });
    }

    private ruleForNewAccount(command: CreateProviderAccountCommand, provider: Provider) {
        if (command.rule) {
            return requireValidRule(command.rule);
        }

        if (provider.defaultRule) {
            return requireValidRule(provider.defaultRule);
        }

        throw new InvalidSubmissionRuleException([
            'The account needs a submission rule: none was given and the provider has no default window.',
        ]);
    }

    private async chooseProvider(providerId: string, householdId: string): Promise<Provider> {
        const provider = await this.providers.findVisibleToHousehold(providerId, householdId);

        if (!provider) {
            throw new ProviderNotFoundException();
        }

        if (provider.archived) {
            throw new ProviderArchivedException();
        }

        return provider;
    }

    private async assertMember(householdId: string, userId: string): Promise<void> {
        try {
            await this.householdAccess.assertCanRead(householdId, userId);
        } catch (error) {
            if (error instanceof HouseholdNotFoundException) {
                throw new ProviderAccountNotFoundException();
            }
            throw error;
        }
    }
}

function todayIn(timeZone: string): Date {
    const {year, month, day} = localDateOf(new Date(), timeZone);
    return new Date(Date.UTC(year, month - 1, day));
}
