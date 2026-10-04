import {Controller, Get, Res} from '@nestjs/common';
import {MetricsService} from './metrics.service.js';

import type {Response} from 'express';

/**
 * Prometheus scrape endpoint (task 10.4): exposes the registry in the text
 * exposition format Prometheus scrapes. Carries no auth — the scraper
 * has no token and the payload holds only aggregate counters. The demo
 * service has no auth guard at all: its only HTTP surface is health and
 * metrics (spec 5 §8).
 */
@Controller('metrics')
export class MetricsController {
    constructor(private readonly metrics: MetricsService) {}

    @Get()
    async scrape(@Res() response: Response): Promise<void> {
        response.setHeader('Content-Type', this.metrics.contentType);
        response.end(await this.metrics.scrape());
    }
}
