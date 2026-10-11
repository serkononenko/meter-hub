import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseFloatPipe, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Cookies, Headers } from '../decorators/index.js';
import { InternalApi } from '../api/index.js';
import type { SubmissionWindow,  } from '../models/index.js';

@Controller()
export class InternalApiController {
  constructor(private readonly internalApi: InternalApi) {}

  @Get('/api/v1/internal/submission-windows')
  listAccountSubmissionWindows(@Query('accountId') accountId: string, @Query('from') _from: string, @Query('to') to: string, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Array<SubmissionWindow> | Promise<Array<SubmissionWindow>> | Observable<Array<SubmissionWindow>> {
    return this.internalApi.listAccountSubmissionWindows(accountId, _from, to, xCorrelationID, request);
  }

} 