import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CreateMeterRequest, Meter, UpdateMeterRequest,  } from '../models/index.js';


@Injectable()
export abstract class MetersApi {

  abstract createMeter(createMeterRequest: CreateMeterRequest, xCorrelationID: string | undefined,  request: Request): Meter | Promise<Meter> | Observable<Meter>;


  abstract getMeter(meterId: string, xCorrelationID: string | undefined,  request: Request): Meter | Promise<Meter> | Observable<Meter>;


  abstract listMeters(householdId: string, xCorrelationID: string | undefined,  request: Request): Array<Meter> | Promise<Array<Meter>> | Observable<Array<Meter>>;


  abstract updateMeter(meterId: string, updateMeterRequest: UpdateMeterRequest, xCorrelationID: string | undefined,  request: Request): Meter | Promise<Meter> | Observable<Meter>;

} 