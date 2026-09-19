import {Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {JwtModule} from "@nestjs/jwt";
import {ConfigService} from "@nestjs/config";
import * as fs from "node:fs";
import {AuthGuard} from './auth.guard.js';


@Module({
    providers: [
        {
            provide: APP_GUARD,
            useClass: AuthGuard,
        },
    ],
    imports: [
        JwtModule.registerAsync({
            global: true,
            useFactory: async (configService: ConfigService) => ({
                publicKey: fs.readFileSync(configService.getOrThrow('identity.jwt.publicKeyPath'), 'utf8'),
                verifyOptions: {
                    audience: configService.getOrThrow('identity.jwt.audience'),
                    issuer: configService.getOrThrow('identity.jwt.issuer'),
                    algorithms: ['RS256'],
                },
            }),
            inject: [ConfigService],
        }),
    ]
})
export class AuthModule {
}
