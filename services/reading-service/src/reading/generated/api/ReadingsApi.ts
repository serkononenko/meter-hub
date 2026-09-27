import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CreateReadingRequest, Reading, ReadingPage,  } from '../models/index.js';


@Injectable()
export abstract class ReadingsApi {

  abstract createReading(createReadingRequest: CreateReadingRequest, xCorrelationID: string | undefined,  request: Request): Reading | Promise<Reading> | Observable<Reading>;


  abstract getLatestReading(meterId: string, xCorrelationID: string | undefined,  request: Request): Reading | Promise<Reading> | Observable<Reading>;


  abstract listReadings(meterId: string, limit: number | undefined, offset: number | undefined, xCorrelationID: string | undefined,  request: Request): ReadingPage | Promise<ReadingPage> | Observable<ReadingPage>;

} 