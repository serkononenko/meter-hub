import {REQUEST} from "@nestjs/core";
import {Provider, Scope} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {Configuration, MetersApi} from './generated/index.js';
import {extractTokenFromHeader} from "../utils/extract-token-from-header.js";

import type {Request} from "express";


export const MeterApiProvider: Provider<MetersApi> = {
    provide: MetersApi,
    scope: Scope.REQUEST,
    useFactory: (request: Request, configService: ConfigService) => {
        const configuration = new Configuration({
            basePath: configService.getOrThrow('meter.url'),
            accessToken: () => extractTokenFromHeader(request) || '',
        });
        return new MetersApi(configuration);
    },
    inject: [REQUEST, ConfigService],
}
