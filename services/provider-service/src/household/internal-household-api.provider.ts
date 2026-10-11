import {REQUEST} from "@nestjs/core";
import {Provider, Scope} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {Configuration, InternalApi} from '../generated/household/index.js';
import {extractTokenFromHeader} from "../utils/extract-token-from-header.js";

import type {Request} from "express";


export const InternalHouseholdApiProvider: Provider<InternalApi> = {
    provide: InternalApi,
    scope: Scope.REQUEST,
    useFactory: (request: Request, configService: ConfigService) => {
        const configuration = new Configuration({
            basePath: configService.getOrThrow('household.url'),
            accessToken: () => extractTokenFromHeader(request) || '',
        });
        return new InternalApi(configuration);
    },
    inject: [REQUEST, ConfigService],
}
