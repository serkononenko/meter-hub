import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CreateMeterBindingRequest, EndMeterBindingRequest, MeterBinding,  } from '../models/index.js';


@Injectable()
export abstract class MeterBindingsApi {

  abstract createMeterBinding(createMeterBindingRequest: CreateMeterBindingRequest, xCorrelationID: string | undefined,  request: Request): MeterBinding | Promise<MeterBinding> | Observable<MeterBinding>;


  abstract endMeterBinding(bindingId: string, endMeterBindingRequest: EndMeterBindingRequest, xCorrelationID: string | undefined,  request: Request): MeterBinding | Promise<MeterBinding> | Observable<MeterBinding>;


  abstract listMeterBindings(meterId: string | undefined, accountId: string | undefined, xCorrelationID: string | undefined,  request: Request): Array<MeterBinding> | Promise<Array<MeterBinding>> | Observable<Array<MeterBinding>>;

} 