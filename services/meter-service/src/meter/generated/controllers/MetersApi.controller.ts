import { Body, Controller, DefaultValuePipe, Get, Patch, Post, Param, ParseIntPipe, ParseFloatPipe, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Cookies, Headers } from '../decorators/index.js';
import { MetersApi } from '../api/index.js';
import type { CreateMeterRequest, Meter, UpdateMeterRequest,  } from '../models/index.js';

@Controller()
export class MetersApiController {
  constructor(private readonly metersApi: MetersApi) {}

  @Post('/api/v1/meters')
  createMeter(@Body() createMeterRequest: CreateMeterRequest, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Meter | Promise<Meter> | Observable<Meter> {
    return this.metersApi.createMeter(createMeterRequest, xCorrelationID, request);
  }

  @Get('/api/v1/meters/:meterId')
  getMeter(@Param('meterId') meterId: string, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Meter | Promise<Meter> | Observable<Meter> {
    return this.metersApi.getMeter(meterId, xCorrelationID, request);
  }

  @Get('/api/v1/meters')
  listMeters(@Query('householdId') householdId: string, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Array<Meter> | Promise<Array<Meter>> | Observable<Array<Meter>> {
    return this.metersApi.listMeters(householdId, xCorrelationID, request);
  }

  @Patch('/api/v1/meters/:meterId')
  updateMeter(@Param('meterId') meterId: string, @Body() updateMeterRequest: UpdateMeterRequest, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Meter | Promise<Meter> | Observable<Meter> {
    return this.metersApi.updateMeter(meterId, updateMeterRequest, xCorrelationID, request);
  }

} 