import {Injectable} from '@nestjs/common';
import {plainToInstance} from 'class-transformer';
import {randomUUID} from 'node:crypto';
import {ProvidersApi} from '../generated/provider/api/index.js';
import {ProviderScope} from '../generated/provider/models/index.js';
import {ADMIN_ROLE, assertAdmin} from '../auth/system-roles.js';
import {HouseholdAccessService} from '../household/household-access.service.js';
import {ProviderAlreadyGlobalException} from '../exceptions/unprocessable.exception.js';
import {ProviderNotFoundException, HouseholdNotFoundException} from '../exceptions/not-found.exception.js';
import {RequestValidationException} from '../exceptions/request-validation.exception.js';
import {requireValidRule} from '../submission-window/require-valid-rule.js';
import {getAuthenticatedUser} from '../utils/get-authenticated-user.js';
import {parseBooleanQuery} from '../utils/parse-boolean-query.js';
import {validateCommand} from '../validation/validate-command.js';
import {optionalUuid, requireUuid} from '../validation/require-uuid.js';
import {CreateProviderCommand} from './commands/create-provider.command.js';
import {UpdateProviderCommand} from './commands/update-provider.command.js';
import {ProviderRepository} from './provider.repository.js';

import type {CreateProviderRequest, Provider, UpdateProviderRequest} from '../generated/provider/models/index.js';
import type {AuthenticatedUser} from '../typedef.js';


@Injectable()
export class ProviderService extends ProvidersApi {
    constructor(
        private readonly repository: ProviderRepository,
        private readonly householdAccess: HouseholdAccessService,
    ) {
        super();
    }

    async createProvider(payload: CreateProviderRequest, _correlationId?: string, request?: Request): Promise<Provider> {
        const user = getAuthenticatedUser(request);
        const command = plainToInstance(CreateProviderCommand, payload);
        await validateCommand(command);

        const householdId = command.scope === ProviderScope.HOUSEHOLD ? command.householdId! : null;
        await this.assertCanManage(householdId, user);

        return this.repository.save({
            id: randomUUID(),
            householdId,
            name: command.name,
            notes: command.notes,
            defaultRule: command.defaultRule ? requireValidRule(command.defaultRule) : undefined,
            actorId: user.userId,
        });
    }

    async listProviders(
        householdId?: string,
        scope?: ProviderScope,
        includeArchived?: boolean,
        _correlationId?: string,
        request?: Request,
    ): Promise<Provider[]> {
        const user = getAuthenticatedUser(request);
        const household = optionalUuid(householdId, 'householdId');

        if (scope !== undefined && !Object.values(ProviderScope).includes(scope)) {
            throw new RequestValidationException([{property: 'scope', constraints: {isEnum: 'scope must be GLOBAL or HOUSEHOLD'}}]);
        }

        if (household) {
            await this.householdAccess.assertCanRead(household, user.userId);
        }

        return this.repository.findVisible({
            householdId: household,
            scope,
            includeArchived: parseBooleanQuery(includeArchived),
            includeAllHouseholds: household === undefined && user.roles.includes(ADMIN_ROLE),
        });
    }

    async getProvider(providerId: string, _correlationId?: string, request?: Request): Promise<Provider> {
        return this.visibleProvider(requireUuid(providerId, 'providerId'), getAuthenticatedUser(request));
    }

    async updateProvider(
        providerId: string,
        payload: UpdateProviderRequest,
        _correlationId?: string,
        request?: Request,
    ): Promise<Provider> {
        const user = getAuthenticatedUser(request);
        const command = plainToInstance(UpdateProviderCommand, payload);
        await validateCommand(command);

        const provider = await this.visibleProvider(requireUuid(providerId, 'providerId'), user);
        await this.assertCanManage(provider.householdId ?? null, user);

        return this.repository.update(provider.id, {
            name: command.name,
            notes: command.notes,
            defaultRule: command.defaultRule ? requireValidRule(command.defaultRule) : undefined,
            archivedAt: command.archived === undefined ? undefined : command.archived ? new Date() : null,
            actorId: user.userId,
        });
    }

    async promoteProvider(providerId: string, _correlationId?: string, request?: Request): Promise<Provider> {
        const user = getAuthenticatedUser(request);
        assertAdmin(user);

        const provider = await this.repository.findById(requireUuid(providerId, 'providerId'));

        if (!provider) {
            throw new ProviderNotFoundException();
        }

        if (provider.scope === ProviderScope.GLOBAL) {
            throw new ProviderAlreadyGlobalException();
        }

        return this.repository.update(provider.id, {householdId: null, actorId: user.userId});
    }

    private async visibleProvider(providerId: string, user: AuthenticatedUser): Promise<Provider> {
        const provider = await this.repository.findById(providerId);

        if (!provider) {
            throw new ProviderNotFoundException();
        }

        if (provider.householdId) {
            await this.assertMemberOfOwningHousehold(provider.householdId, user);
        }

        return provider;
    }

    private async assertMemberOfOwningHousehold(householdId: string, user: AuthenticatedUser): Promise<void> {
        try {
            await this.householdAccess.assertCanRead(householdId, user.userId);
        } catch (error) {
            if (error instanceof HouseholdNotFoundException) {
                throw new ProviderNotFoundException();
            }
            throw error;
        }
    }

    private async assertCanManage(householdId: string | null, user: AuthenticatedUser): Promise<void> {
        if (householdId === null) {
            assertAdmin(user);
            return;
        }

        await this.householdAccess.assertCanWrite(householdId, user.userId);
    }
}
