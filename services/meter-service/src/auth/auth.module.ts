import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { JwtVerifier } from './jwt-verifier.js';
import { loadJwtConfigFromEnv } from './jwt-config.js';

/**
 * Bearer-token authentication for every meter endpoint. The verifier is
 * configured eagerly at bootstrap so a missing or malformed public key fails
 * container startup instead of the first request.
 */
@Module({
  providers: [
    {
      provide: JwtVerifier,
      useFactory: async () => {
        const verifier = new JwtVerifier();
        await verifier.configure(loadJwtConfigFromEnv());
        return verifier;
      },
    },
    AuthGuard,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [JwtVerifier],
})
export class AuthModule {}
