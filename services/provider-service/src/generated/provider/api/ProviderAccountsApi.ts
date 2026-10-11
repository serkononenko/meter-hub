import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CreateProviderAccountRequest, ProviderAccount, UpdateProviderAccountRequest,  } from '../models/index.js';


@Injectable()
export abstract class ProviderAccountsApi {

  abstract createProviderAccount(createProviderAccountRequest: CreateProviderAccountRequest, xCorrelationID: string | undefined,  request: Request): ProviderAccount | Promise<ProviderAccount> | Observable<ProviderAccount>;


  abstract getProviderAccount(accountId: string, xCorrelationID: string | undefined,  request: Request): ProviderAccount | Promise<ProviderAccount> | Observable<ProviderAccount>;


  abstract listProviderAccounts(householdId: string, providerId: string | undefined, includeArchived: boolean | undefined, xCorrelationID: string | undefined,  request: Request): Array<ProviderAccount> | Promise<Array<ProviderAccount>> | Observable<Array<ProviderAccount>>;


  abstract updateProviderAccount(accountId: string, updateProviderAccountRequest: UpdateProviderAccountRequest, xCorrelationID: string | undefined,  request: Request): ProviderAccount | Promise<ProviderAccount> | Observable<ProviderAccount>;

} 