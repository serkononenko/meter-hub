import { Body, Controller, DefaultValuePipe, Get, Patch, Post, Param, ParseIntPipe, ParseFloatPipe, Query, Req } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Cookies, Headers } from '../decorators/index.js';
import { MeterBindingsApi } from '../api/index.js';
import type { CreateMeterBindingRequest, EndMeterBindingRequest, MeterBinding,  } from '../models/index.js';

@Controller()
export class MeterBindingsApiController {
  constructor(private readonly meterBindingsApi: MeterBindingsApi) {}

  @Post('/api/v1/meter-bindings')
  createMeterBinding(@Body() createMeterBindingRequest: CreateMeterBindingRequest, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): MeterBinding | Promise<MeterBinding> | Observable<MeterBinding> {
    return this.meterBindingsApi.createMeterBinding(createMeterBindingRequest, xCorrelationID, request);
  }

  @Patch('/api/v1/meter-bindings/:bindingId')
  endMeterBinding(@Param('bindingId') bindingId: string, @Body() endMeterBindingRequest: EndMeterBindingRequest, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): MeterBinding | Promise<MeterBinding> | Observable<MeterBinding> {
    return this.meterBindingsApi.endMeterBinding(bindingId, endMeterBindingRequest, xCorrelationID, request);
  }

  @Get('/api/v1/meter-bindings')
  listMeterBindings(@Query('meterId') meterId: string | undefined, @Query('accountId') accountId: string | undefined, @Headers('X-Correlation-ID') xCorrelationID: string | undefined, @Req() request: Request): Array<MeterBinding> | Promise<Array<MeterBinding>> | Observable<Array<MeterBinding>> {
    return this.meterBindingsApi.listMeterBindings(meterId, accountId, xCorrelationID, request);
  }

} 