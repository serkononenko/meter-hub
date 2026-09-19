import { Body, Controller, DefaultValuePipe, Get, Post, Param, ParseIntPipe, ParseFloatPipe, Query, Req } from '@nestjs/common';
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

  @Get('/api/v1/meters/:meterId/readings/latest')
  getLatestReading(@Param('meterId') meterId: string, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Reading | Promise<Reading> | Observable<Reading> {
    return this.readingsApi.getLatestReading(meterId, xCorrelationID, request);
  }

  @Get('/api/v1/meters/:meterId/readings')
  listReadings(@Param('meterId') meterId: string, @Query('limit', new DefaultValuePipe(50)) limit: number | undefined, @Query('offset', new DefaultValuePipe(0)) offset: number | undefined, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Array<Reading> | Promise<Array<Reading>> | Observable<Array<Reading>> {
    return this.readingsApi.listReadings(meterId, limit, offset, xCorrelationID, request);
  }

} 