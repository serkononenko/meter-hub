import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CreateReadingRequest, Reading,  } from '../models/index.js';


@Injectable()
export abstract class ReadingsApi {

  abstract createReading(createReadingRequest: CreateReadingRequest, xCorrelationID: string | undefined,  request: Request): Reading | Promise<Reading> | Observable<Reading>;

} 