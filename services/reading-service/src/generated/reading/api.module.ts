import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ApiImplementations } from './api-implementations.js'
import { ReadingsApi } from './api/index.js';
import { ReadingsApiController } from './controllers/index.js';

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
          provide: ReadingsApi,
          useClass: configuration.apiImplementations.readingsApi
        },
        ...(configuration.providers || []),
      ];

      return {
        module: ApiModule,
        controllers: [
          ReadingsApiController,
        ],
        providers: [...providers],
        exports: [...providers]
      }
    }
}