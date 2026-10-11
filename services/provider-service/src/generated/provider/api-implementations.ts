import { Type } from '@nestjs/common';
import { InternalApi } from './api/index.js';
import { MeterBindingsApi } from './api/index.js';
import { ProviderAccountsApi } from './api/index.js';
import { ProvidersApi } from './api/index.js';
import { SubmissionWindowsApi } from './api/index.js';

/**
 * Provide this type to {@link ApiModule} to provide your API implementations
**/
export type ApiImplementations = {
  internalApi: Type<InternalApi>
  meterBindingsApi: Type<MeterBindingsApi>
  providerAccountsApi: Type<ProviderAccountsApi>
  providersApi: Type<ProvidersApi>
  submissionWindowsApi: Type<SubmissionWindowsApi>
};
