import {Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {randomUUID} from 'node:crypto';
import {ProviderAccountRepository} from '../account/provider-account.repository.js';
import {TransactionManager} from '../database/transaction.manager.js';
import {
    HouseholdNotFoundException,
    MeterBindingNotFoundException,
    MeterNotFoundException,
    ProviderAccountNotFoundException,
} from '../exceptions/not-found.exception.js';
import {
    AccountArchivedException,
    BindingAlreadyEndedException,
    HouseholdMismatchException,
    InvalidBindingPeriodException,
    MeterAlreadyBoundException,
    UnknownMeterReferenceException,
} from '../exceptions/unprocessable.exception.js';
import {Prisma} from '../generated/prisma/client.js';
import {MeterBindingsApi} from '../generated/provider/api/index.js';
import {HouseholdAccessService} from '../household/household-access.service.js';
import {MeterLookupService} from '../meter/meter-lookup.service.js';
import {OutboxRepository} from '../outbox/outbox.repository.js';
import {bindingChanged} from '../outbox/provider-events.js';
import {localDateOf} from '../submission-window/calendar.js';
import {getAuthenticatedUser} from '../utils/get-authenticated-user.js';
import {optionalUuid, requireUuid} from '../validation/require-uuid.js';
import {validateCommand} from '../validation/validate-command.js';
import {RequestValidationException} from '../exceptions/request-validation.exception.js';
import {formatDate} from './binding.mapper.js';
import {CreateMeterBindingCommand} from './commands/create-meter-binding.command.js';
import {EndMeterBindingCommand} from './commands/end-meter-binding.command.js';
import {MeterBindingRepository} from './meter-binding.repository.js';

import type {
    CreateMeterBindingRequest,
    EndMeterBindingRequest,
    MeterBinding,
} from '../generated/provider/models/index.js';


@Injectable()
export class MeterBindingService extends MeterBindingsApi {
    constructor(
        private readonly transactions: TransactionManager,
        private readonly bindings: MeterBindingRepository,
        private readonly accounts: ProviderAccountRepository,
        private readonly meters: MeterLookupService,
        private readonly householdAccess: HouseholdAccessService,
        private readonly outbox: OutboxRepository,
    ) {
        super();
    }

    async createMeterBinding(
        payload: CreateMeterBindingRequest,
        _correlationId?: string,
        request?: Request,
    ): Promise<MeterBinding> {
        const user = getAuthenticatedUser(request);
        const command = plainToInstance(CreateMeterBindingCommand, payload);
        await validateCommand(command);

        const account = await this.accounts.findById(command.accountId);

        if (!account) {
            throw new ProviderAccountNotFoundException();
        }

        await this.assertMember(account.householdId, user.userId);
        await this.householdAccess.assertCanWrite(account.householdId, user.userId);

        if (account.archived) {
            throw new AccountArchivedException();
        }

        // Resolved before the transaction: a database transaction must not span a network call.
        const meter = await this.visibleMeterReference(command.meterId);

        if (meter.householdId !== account.householdId) {
            throw new HouseholdMismatchException();
        }

        const validFrom = command.validFrom ?? formatDate(todayIn(account.rule.timezone));

        try {
            return await this.transactions.execute(async (tx) => {
                await this.bindings.lockMeter(command.meterId, tx);

                if (await this.bindings.overlapsOpenEndedFrom(command.meterId, validFrom, tx)) {
                    throw new MeterAlreadyBoundException();
                }

                const created = await this.bindings.save({
                    id: randomUUID(),
                    accountId: account.id,
                    householdId: account.householdId,
                    meterId: command.meterId,
                    validFrom,
                    actorId: user.userId,
                }, tx);
                await this.outbox.save(bindingChanged(created), created.meterId, tx);
                return created;
            });
        } catch (error) {
            // The advisory lock serialises writers; the partial unique index is the backstop that
            // still holds if a path ever skips the lock.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new MeterAlreadyBoundException();
            }
            throw error;
        }
    }

    async listMeterBindings(
        meterId?: string,
        accountId?: string,
        _correlationId?: string,
        request?: Request,
    ): Promise<MeterBinding[]> {
        const user = getAuthenticatedUser(request);
        const meter = optionalUuid(meterId, 'meterId');
        const account = optionalUuid(accountId, 'accountId');

        if ((meter === undefined) === (account === undefined)) {
            throw new RequestValidationException([{
                property: 'meterId',
                constraints: {exactlyOne: 'exactly one of meterId and accountId is required'},
            }]);
        }

        if (account) {
            return this.listForAccount(account, user.userId);
        }

        return this.listForMeter(meter!, user.userId);
    }

    async endMeterBinding(
        bindingId: string,
        payload: EndMeterBindingRequest,
        _correlationId?: string,
        request?: Request,
    ): Promise<MeterBinding> {
        const user = getAuthenticatedUser(request);
        const command = plainToInstance(EndMeterBindingCommand, payload);
        await validateCommand(command);

        const id = requireUuid(bindingId, 'bindingId');
        const existing = await this.bindings.findById(id);

        if (!existing) {
            throw new MeterBindingNotFoundException();
        }

        await this.assertMember(existing.householdId, user.userId, MeterBindingNotFoundException);
        await this.householdAccess.assertCanWrite(existing.householdId, user.userId);

        return this.transactions.execute(async (tx) => {
            await this.bindings.lockMeter(existing.meterId, tx);
            const current = await this.bindings.findById(id, tx);

            if (!current) {
                throw new MeterBindingNotFoundException();
            }

            if (current.validTo) {
                throw new BindingAlreadyEndedException();
            }

            if (command.validTo < current.validFrom) {
                throw new InvalidBindingPeriodException(current.validFrom, command.validTo);
            }

            const ended = await this.bindings.end(id, command.validTo, user.userId, tx);
            await this.outbox.save(bindingChanged(ended), ended.meterId, tx);
            return ended;
        });
    }

    private async visibleMeterReference(meterId: string) {
        try {
            return await this.meters.getVisibleMeter(meterId);
        } catch (error) {
            if (error instanceof MeterNotFoundException) {
                throw new UnknownMeterReferenceException();
            }
            throw error;
        }
    }

    private async listForAccount(accountId: string, userId: string): Promise<MeterBinding[]> {
        const account = await this.accounts.findById(accountId);

        if (!account) {
            throw new ProviderAccountNotFoundException();
        }

        await this.assertMember(account.householdId, userId);
        return this.bindings.findByAccount(accountId);
    }

    private async listForMeter(meterId: string, userId: string): Promise<MeterBinding[]> {
        const meter = await this.meters.getVisibleMeter(meterId);
        await this.householdAccess.assertCanRead(meter.householdId, userId);
        return this.bindings.findByMeter(meterId);
    }

    private async assertMember(
        householdId: string,
        userId: string,
        notFound: new () => Error = ProviderAccountNotFoundException,
    ): Promise<void> {
        try {
            await this.householdAccess.assertCanRead(householdId, userId);
        } catch (error) {
            if (error instanceof HouseholdNotFoundException) {
                throw new notFound();
            }
            throw error;
        }
    }
}

function todayIn(timeZone: string): Date {
    const {year, month, day} = localDateOf(new Date(), timeZone);
    return new Date(Date.UTC(year, month - 1, day));
}
