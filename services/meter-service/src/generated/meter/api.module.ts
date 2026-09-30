import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ApiImplementations } from './api-implementations.js'
import { MetersApi } from './api/index.js';
import { MetersApiController } from './controllers/index.js';

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
          provide: MetersApi,
          useClass: configuration.apiImplementations.metersApi
        },
        ...(configuration.providers || []),
      ];

      return {
        module: ApiModule,
        controllers: [
          MetersApiController,
        ],
        providers: [...providers],
        exports: [...providers]
      }
    }
}