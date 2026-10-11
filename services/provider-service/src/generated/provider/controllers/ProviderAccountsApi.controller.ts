import { Body, Controller, DefaultValuePipe, Get, Patch, Post, Param, ParseIntPipe, ParseFloatPipe, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Cookies, Headers } from '../decorators/index.js';
import { ProviderAccountsApi } from '../api/index.js';
import type { CreateProviderAccountRequest, ProviderAccount, UpdateProviderAccountRequest,  } from '../models/index.js';

@Controller()
export class ProviderAccountsApiController {
  constructor(private readonly providerAccountsApi: ProviderAccountsApi) {}

  @Post('/api/v1/provider-accounts')
  createProviderAccount(@Body() createProviderAccountRequest: CreateProviderAccountRequest, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): ProviderAccount | Promise<ProviderAccount> | Observable<ProviderAccount> {
    return this.providerAccountsApi.createProviderAccount(createProviderAccountRequest, xCorrelationID, request);
  }

  @Get('/api/v1/provider-accounts/:accountId')
  getProviderAccount(@Param('accountId') accountId: string, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): ProviderAccount | Promise<ProviderAccount> | Observable<ProviderAccount> {
    return this.providerAccountsApi.getProviderAccount(accountId, xCorrelationID, request);
  }

  @Get('/api/v1/provider-accounts')
  listProviderAccounts(@Query('householdId') householdId: string, @Query('providerId') providerId: string | undefined, @Query('includeArchived', new DefaultValuePipe(false)) includeArchived: boolean | undefined, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Array<ProviderAccount> | Promise<Array<ProviderAccount>> | Observable<Array<ProviderAccount>> {
    return this.providerAccountsApi.listProviderAccounts(householdId, providerId, includeArchived, xCorrelationID, request);
  }

  @Patch('/api/v1/provider-accounts/:accountId')
  updateProviderAccount(@Param('accountId') accountId: string, @Body() updateProviderAccountRequest: UpdateProviderAccountRequest, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): ProviderAccount | Promise<ProviderAccount> | Observable<ProviderAccount> {
    return this.providerAccountsApi.updateProviderAccount(accountId, updateProviderAccountRequest, xCorrelationID, request);
  }

} 