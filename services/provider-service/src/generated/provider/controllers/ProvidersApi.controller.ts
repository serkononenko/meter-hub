import { Body, Controller, DefaultValuePipe, Get, Patch, Post, Param, ParseIntPipe, ParseFloatPipe, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Cookies, Headers } from '../decorators/index.js';
import { ProvidersApi } from '../api/index.js';
import type { CreateProviderRequest, Provider, ProviderScope, UpdateProviderRequest,  } from '../models/index.js';

@Controller()
export class ProvidersApiController {
  constructor(private readonly providersApi: ProvidersApi) {}

  @Post('/api/v1/providers')
  createProvider(@Body() createProviderRequest: CreateProviderRequest, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Provider | Promise<Provider> | Observable<Provider> {
    return this.providersApi.createProvider(createProviderRequest, xCorrelationID, request);
  }

  @Get('/api/v1/providers/:providerId')
  getProvider(@Param('providerId') providerId: string, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Provider | Promise<Provider> | Observable<Provider> {
    return this.providersApi.getProvider(providerId, xCorrelationID, request);
  }

  @Get('/api/v1/providers')
  listProviders(@Query('householdId') householdId: string | undefined, @Query('scope') scope: ProviderScope | undefined, @Query('includeArchived', new DefaultValuePipe(false)) includeArchived: boolean | undefined, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Array<Provider> | Promise<Array<Provider>> | Observable<Array<Provider>> {
    return this.providersApi.listProviders(householdId, scope, includeArchived, xCorrelationID, request);
  }

  @Post('/api/v1/providers/:providerId/promote')
  promoteProvider(@Param('providerId') providerId: string, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Provider | Promise<Provider> | Observable<Provider> {
    return this.providersApi.promoteProvider(providerId, xCorrelationID, request);
  }

  @Patch('/api/v1/providers/:providerId')
  updateProvider(@Param('providerId') providerId: string, @Body() updateProviderRequest: UpdateProviderRequest, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Provider | Promise<Provider> | Observable<Provider> {
    return this.providersApi.updateProvider(providerId, updateProviderRequest, xCorrelationID, request);
  }

} 