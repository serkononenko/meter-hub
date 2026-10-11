import {Module} from '@nestjs/common';
import {ApiImplementations, ApiModule} from '../generated/provider/index.js';
import {ProvidersApiController} from '../generated/provider/controllers/index.js';
import {decorateHttpCode} from '../decorators/http-code.js';
import {ProviderAccountRepository} from '../account/provider-account.repository.js';
import {ProviderAccountService} from '../account/provider-account.service.js';
import {MeterBindingRepository} from '../binding/meter-binding.repository.js';
import {MeterBindingService} from '../binding/meter-binding.service.js';
import {HouseholdModule} from '../household/household.module.js';
import {MeterModule} from '../meter/meter.module.js';
import {NotYetImplementedInternal, NotYetImplementedWindows} from './not-yet-implemented.provider.js';
import {ProviderRepository} from './provider.repository.js';
import {ProviderService} from './provider.service.js';


decorateHttpCode(ProvidersApiController, 'promoteProvider', 200);

const apiImplementations: ApiImplementations = {
    providersApi: ProviderService,
    providerAccountsApi: ProviderAccountService,
    meterBindingsApi: MeterBindingService,
    submissionWindowsApi: NotYetImplementedWindows,
    internalApi: NotYetImplementedInternal,
}

@Module({
    imports: [
        ApiModule.forRoot({
            apiImplementations,
            providers: [
                ProviderRepository,
                ProviderAccountRepository,
                MeterBindingRepository,
                ...Reflect.getMetadata('providers', HouseholdModule),
                ...Reflect.getMetadata('providers', MeterModule),
            ],
        }),
    ],
})
export class ProviderModule {
}
