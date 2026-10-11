import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MeterSubmissionWindows,  } from '../models/index.js';


@Injectable()
export abstract class SubmissionWindowsApi {

  abstract getSubmissionWindows(meterId: string, at: string | undefined, xCorrelationID: string | undefined,  request: Request): MeterSubmissionWindows | Promise<MeterSubmissionWindows> | Observable<MeterSubmissionWindows>;

} 