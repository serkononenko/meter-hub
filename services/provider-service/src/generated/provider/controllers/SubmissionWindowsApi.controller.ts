import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseFloatPipe, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Cookies, Headers } from '../decorators/index.js';
import { SubmissionWindowsApi } from '../api/index.js';
import type { MeterSubmissionWindows,  } from '../models/index.js';

@Controller()
export class SubmissionWindowsApiController {
  constructor(private readonly submissionWindowsApi: SubmissionWindowsApi) {}

  @Get('/api/v1/submission-windows')
  getSubmissionWindows(@Query('meterId') meterId: string, @Query('at') at: string | undefined, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): MeterSubmissionWindows | Promise<MeterSubmissionWindows> | Observable<MeterSubmissionWindows> {
    return this.submissionWindowsApi.getSubmissionWindows(meterId, at, xCorrelationID, request);
  }

} 