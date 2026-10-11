import {Injectable} from '@nestjs/common';
import {InternalApi, MeterBindingsApi, ProviderAccountsApi, SubmissionWindowsApi} from '../generated/provider/api/index.js';
import {NotYetImplementedException} from '../exceptions/unprocessable.exception.js';


@Injectable()
export class NotYetImplementedAccounts extends ProviderAccountsApi {
    createProviderAccount(): never { throw new NotYetImplementedException(); }
    getProviderAccount(): never { throw new NotYetImplementedException(); }
    listProviderAccounts(): never { throw new NotYetImplementedException(); }
    updateProviderAccount(): never { throw new NotYetImplementedException(); }
}

@Injectable()
export class NotYetImplementedBindings extends MeterBindingsApi {
    createMeterBinding(): never { throw new NotYetImplementedException(); }
    endMeterBinding(): never { throw new NotYetImplementedException(); }
    listMeterBindings(): never { throw new NotYetImplementedException(); }
}

@Injectable()
export class NotYetImplementedWindows extends SubmissionWindowsApi {
    getSubmissionWindows(): never { throw new NotYetImplementedException(); }
}

@Injectable()
export class NotYetImplementedInternal extends InternalApi {
    listAccountSubmissionWindows(): never { throw new NotYetImplementedException(); }
}
