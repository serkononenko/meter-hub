import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CreateProviderRequest, Provider, ProviderScope, UpdateProviderRequest,  } from '../models/index.js';


@Injectable()
export abstract class ProvidersApi {

  abstract createProvider(createProviderRequest: CreateProviderRequest, xCorrelationID: string | undefined,  request: Request): Provider | Promise<Provider> | Observable<Provider>;


  abstract getProvider(providerId: string, xCorrelationID: string | undefined,  request: Request): Provider | Promise<Provider> | Observable<Provider>;


  abstract listProviders(householdId: string | undefined, scope: ProviderScope | undefined, includeArchived: boolean | undefined, xCorrelationID: string | undefined,  request: Request): Array<Provider> | Promise<Array<Provider>> | Observable<Array<Provider>>;


  abstract promoteProvider(providerId: string, xCorrelationID: string | undefined,  request: Request): Provider | Promise<Provider> | Observable<Provider>;


  abstract updateProvider(providerId: string, updateProviderRequest: UpdateProviderRequest, xCorrelationID: string | undefined,  request: Request): Provider | Promise<Provider> | Observable<Provider>;

} 