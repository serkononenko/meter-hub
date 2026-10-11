import {Module} from '@nestjs/common';
import {ApiImplementations, ApiModule} from '../generated/provider/index.js';
import {ProvidersApiController} from '../generated/provider/controllers/index.js';
import {decorateHttpCode} from '../decorators/http-code.js';
import {HouseholdModule} from '../household/household.module.js';
import {
    NotYetImplementedAccounts,
    NotYetImplementedBindings,
    NotYetImplementedInternal,
    NotYetImplementedWindows,
} from './not-yet-implemented.provider.js';
import {ProviderRepository} from './provider.repository.js';
import {ProviderService} from './provider.service.js';


decorateHttpCode(ProvidersApiController, 'promoteProvider', 200);

const apiImplementations: ApiImplementations = {
    providersApi: ProviderService,
    providerAccountsApi: NotYetImplementedAccounts,
    meterBindingsApi: NotYetImplementedBindings,
    submissionWindowsApi: NotYetImplementedWindows,
    internalApi: NotYetImplementedInternal,
}

@Module({
    imports: [
        ApiModule.forRoot({
            apiImplementations,
            providers: [ProviderRepository, ...Reflect.getMetadata('providers', HouseholdModule)],
        }),
    ],
})
export class ProviderModule {
}
