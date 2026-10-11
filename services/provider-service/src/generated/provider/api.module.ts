import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ApiImplementations } from './api-implementations.js'
import { InternalApi } from './api/index.js';
import { InternalApiController } from './controllers/index.js';
import { MeterBindingsApi } from './api/index.js';
import { MeterBindingsApiController } from './controllers/index.js';
import { ProviderAccountsApi } from './api/index.js';
import { ProviderAccountsApiController } from './controllers/index.js';
import { ProvidersApi } from './api/index.js';
import { ProvidersApiController } from './controllers/index.js';
import { SubmissionWindowsApi } from './api/index.js';
import { SubmissionWindowsApiController } from './controllers/index.js';

export type ApiModuleConfiguration = {
  /**
  * your Api implementations
  */
  apiImplementations: ApiImplementations,
  /**
  * additional Providers that may be used by your implementations
  */
  providers?: Provider[],
}

@Module({})
export class ApiModule {
  static forRoot(configuration: ApiModuleConfiguration): DynamicModule {
      const providers: Provider[] = [
        {
          provide: InternalApi,
          useClass: configuration.apiImplementations.internalApi
        },
        {
          provide: MeterBindingsApi,
          useClass: configuration.apiImplementations.meterBindingsApi
        },
        {
          provide: ProviderAccountsApi,
          useClass: configuration.apiImplementations.providerAccountsApi
        },
        {
          provide: ProvidersApi,
          useClass: configuration.apiImplementations.providersApi
        },
        {
          provide: SubmissionWindowsApi,
          useClass: configuration.apiImplementations.submissionWindowsApi
        },
        ...(configuration.providers || []),
      ];

      return {
        module: ApiModule,
        controllers: [
          InternalApiController,
          MeterBindingsApiController,
          ProviderAccountsApiController,
          ProvidersApiController,
          SubmissionWindowsApiController,
        ],
        providers: [...providers],
        exports: [...providers]
      }
    }
}