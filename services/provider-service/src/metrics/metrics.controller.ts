import {Controller, Get, Res} from '@nestjs/common';
import {Public} from '../decorators/public.decorator.js';
import {MetricsService} from './metrics.service.js';

import type {Response} from 'express';


@Public()
@Controller('metrics')
export class MetricsController {
    constructor(private readonly metrics: MetricsService) {}

    @Get()
    async scrape(@Res() response: Response): Promise<void> {
        response.setHeader('Content-Type', this.metrics.contentType);
        response.end(await this.metrics.scrape());
    }
}
