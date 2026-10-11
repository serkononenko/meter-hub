import {Injectable} from '@nestjs/common';
import {ProviderAccountRepository} from '../account/provider-account.repository.js';
import {MeterBindingRepository} from '../binding/meter-binding.repository.js';
import {parseDate} from '../binding/binding.mapper.js';
import {ProviderAccountNotFoundException} from '../exceptions/not-found.exception.js';
import {RequestValidationException} from '../exceptions/request-validation.exception.js';
import {InternalApi, SubmissionWindowsApi} from '../generated/provider/api/index.js';
import {HouseholdAccessService} from '../household/household-access.service.js';
import {MeterLookupService} from '../meter/meter-lookup.service.js';
import {localDateOf} from '../submission-window/calendar.js';
import {currentAndNext} from '../submission-window/submission-window.js';
import {getAuthenticatedUser} from '../utils/get-authenticated-user.js';
import {requireUuid} from '../validation/require-uuid.js';
import {toWindowDto} from './submission-window.mapper.js';
import {windowsOverlapping} from './windows-in-range.js';

import type {MeterSubmissionWindows, SubmissionWindow} from '../generated/provider/models/index.js';


@Injectable()
export class SubmissionWindowService extends SubmissionWindowsApi {
    constructor(
        private readonly meters: MeterLookupService,
        private readonly bindings: MeterBindingRepository,
        private readonly accounts: ProviderAccountRepository,
        private readonly householdAccess: HouseholdAccessService,
    ) {
        super();
    }

    async getSubmissionWindows(
        meterId: string,
        at?: string,
        _correlationId?: string,
        request?: Request,
    ): Promise<MeterSubmissionWindows> {
        const user = getAuthenticatedUser(request);
        const id = requireUuid(meterId, 'meterId');
        const instant = parseInstant(at, 'at') ?? new Date();

        const meter = await this.meters.getVisibleMeter(id);
        await this.householdAccess.assertCanRead(meter.householdId, user.userId);

        const inForce = await this.bindingInForce(id, instant);

        if (!inForce) {
            return {};
        }

        const {binding, account} = inForce;
        const {current, next} = currentAndNext(account.rule, instant);

        return {
            binding,
            ...(current ? {current: toWindowDto(current, account.id, account.providerId)} : {}),
            next: toWindowDto(next, account.id, account.providerId),
        };
    }

    private async bindingInForce(meterId: string, instant: Date) {
        const candidate = await this.bindings.findByMeter(meterId);

        for (const binding of candidate) {
            const account = await this.accounts.findById(binding.accountId);

            if (!account) {
                continue;
            }

            const {year, month, day} = localDateOf(instant, account.rule.timezone);
            const today = new Date(Date.UTC(year, month - 1, day));
            const started = parseDate(binding.validFrom) <= today;
            const notEnded = !binding.validTo || parseDate(binding.validTo) >= today;

            if (started && notEnded) {
                return {binding, account};
            }
        }

        return null;
    }
}

@Injectable()
export class InternalSubmissionWindowService extends InternalApi {
    constructor(private readonly accounts: ProviderAccountRepository) {
        super();
    }

    async listAccountSubmissionWindows(
        accountId: string,
        from: string,
        to: string,
    ): Promise<SubmissionWindow[]> {
        const id = requireUuid(accountId, 'accountId');
        const start = requireInstant(from, 'from');
        const end = requireInstant(to, 'to');

        if (end <= start) {
            throw new RequestValidationException([{
                property: 'to',
                constraints: {range: 'from and to must be timestamps with from before to'},
            }]);
        }

        const account = await this.accounts.findById(id);

        if (!account) {
            throw new ProviderAccountNotFoundException();
        }

        return windowsOverlapping(account.rule, start, end)
            .map((window) => toWindowDto(window, account.id, account.providerId));
    }
}

function requireInstant(value: string | undefined, field: string): Date {
    return parseInstant(value, field) ?? failInstant(field);
}

function failInstant(field: string): never {
    throw new RequestValidationException([{
        property: field,
        constraints: {isDateTime: `${field} is required and must be an RFC 3339 timestamp`},
    }]);
}

function parseInstant(value: string | undefined, field: string): Date | undefined {
    if (value === undefined) {
        return undefined;
    }

    const parsed = new Date(value);

    if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(parsed.getTime())) {
        throw new RequestValidationException([{
            property: field,
            constraints: {isDateTime: `${field} must be an RFC 3339 timestamp`},
        }]);
    }

    return parsed;
}
