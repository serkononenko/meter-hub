import { Body, Controller, DefaultValuePipe, Post, Param, ParseIntPipe, ParseFloatPipe, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Cookies, Headers } from '../decorators/index.js';
import { ReadingsApi } from '../api/index.js';
import type { CreateReadingRequest, Reading,  } from '../models/index.js';

@Controller()
export class ReadingsApiController {
  constructor(private readonly readingsApi: ReadingsApi) {}

  @Post('/api/v1/readings')
  createReading(@Body() createReadingRequest: CreateReadingRequest, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Reading | Promise<Reading> | Observable<Reading> {
    return this.readingsApi.createReading(createReadingRequest, xCorrelationID, request);
  }

} 