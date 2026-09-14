import {REQUEST} from "@nestjs/core";
import {Provider, Scope} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {Configuration, HouseholdsApi} from './generated/index.js';
import {extractTokenFromHeader} from "../utils/extract-token-from-header.js";

import type {Request} from "express";


export const HouseholdApiProvider: Provider<HouseholdsApi> = {
    provide: HouseholdsApi,
    scope: Scope.REQUEST,
    useFactory: (request: Request, configService: ConfigService) => {
        const configuration = new Configuration({
            basePath: configService.getOrThrow('household.url'),
            accessToken: () => extractTokenFromHeader(request) || '',
        });
        return new HouseholdsApi(configuration);
    },
    inject: [REQUEST, ConfigService],
}