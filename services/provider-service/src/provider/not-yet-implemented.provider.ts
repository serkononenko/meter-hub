import {Injectable} from '@nestjs/common';
import {InternalApi, SubmissionWindowsApi} from '../generated/provider/api/index.js';
import {NotYetImplementedException} from '../exceptions/not-implemented.exception.js';


@Injectable()
export class NotYetImplementedWindows extends SubmissionWindowsApi {
    getSubmissionWindows(): never { throw new NotYetImplementedException(); }
}

@Injectable()
export class NotYetImplementedInternal extends InternalApi {
    listAccountSubmissionWindows(): never { throw new NotYetImplementedException(); }
}
