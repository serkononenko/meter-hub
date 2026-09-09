import { Module } from '@nestjs/common';
import { HttpHouseholdAccessClient } from './household-access.client.js';
import { loadHouseholdAccessConfigFromEnv } from './household-access.config.js';
import { HOUSEHOLD_ACCESS_CONFIG, HOUSEHOLD_ACCESS_PORT } from './household-access.tokens.js';

/**
 * Outbound household-ownership checks (5.4). Binds the port to the HTTP
 * adapter; tests and future implementations swap the binding, keeping the
 * meter service unaware of how ownership is resolved.
 */
@Module({
  providers: [
    {
      provide: HOUSEHOLD_ACCESS_CONFIG,
      useFactory: loadHouseholdAccessConfigFromEnv,
    },
    { provide: HOUSEHOLD_ACCESS_PORT, useClass: HttpHouseholdAccessClient },
  ],
  exports: [HOUSEHOLD_ACCESS_PORT],
})
export class HouseholdAccessModule {}
