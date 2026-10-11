import {Module} from '@nestjs/common';
import {ApiImplementations, ApiModule} from '../generated/provider/index.js';
import {InternalApiController, ProvidersApiController} from '../generated/provider/controllers/index.js';
import {decoratePublicController} from '../decorators/public-controller.js';
import {decorateHttpCode} from '../decorators/http-code.js';
import {ProviderAccountRepository} from '../account/provider-account.repository.js';
import {ProviderAccountService} from '../account/provider-account.service.js';
import {MeterBindingRepository} from '../binding/meter-binding.repository.js';
import {MeterBindingService} from '../binding/meter-binding.service.js';
import {HouseholdModule} from '../household/household.module.js';
import {MeterModule} from '../meter/meter.module.js';
import {InternalSubmissionWindowService, SubmissionWindowService} from '../window/submission-window.service.js';
import {ProviderRepository} from './provider.repository.js';
import {ProviderService} from './provider.service.js';


decorateHttpCode(ProvidersApiController, 'promoteProvider', 200);
// Internal surface: no bearer token, reachable only on the internal network until service-to-service auth (A1).
decoratePublicController(InternalApiController);

const apiImplementations: ApiImplementations = {
    providersApi: ProviderService,
    providerAccountsApi: ProviderAccountService,
    meterBindingsApi: MeterBindingService,
    submissionWindowsApi: SubmissionWindowService,
    internalApi: InternalSubmissionWindowService,
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
