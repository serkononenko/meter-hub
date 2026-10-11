import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SubmissionWindow,  } from '../models/index.js';


@Injectable()
export abstract class InternalApi {

  abstract listAccountSubmissionWindows(accountId: string, _from: string, to: string, xCorrelationID: string | undefined,  request: Request): Array<SubmissionWindow> | Promise<Array<SubmissionWindow>> | Observable<Array<SubmissionWindow>>;

} 