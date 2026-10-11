import {Test} from '@nestjs/testing';
import {describe, expect, it, beforeEach, vi} from 'vitest';
import {MetricsController} from './metrics.controller.js';
import {MetricsService} from './metrics.service.js';

describe('MetricsController', () => {
    let controller: MetricsController;
    let scrape: ReturnType<typeof vi.fn<() => Promise<string>>>;

    beforeEach(async () => {
        scrape = vi.fn(async () => '# HELP http_requests_total test\n');
        const moduleRef = await Test.createTestingModule({
            controllers: [MetricsController],
        })
            .useMocker((token) => {
                if (token === MetricsService) {
                    return {contentType: 'text/plain; version=0.0.4', scrape};
                }
                return {};
            })
            .compile();

        controller = moduleRef.get(MetricsController);
    });

    it('serves the registry payload with the Prometheus content type', async () => {
        const setHeader = vi.fn();
        const end = vi.fn();

        await controller.scrape({setHeader, end} as never);

        expect(setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; version=0.0.4');
        expect(end).toHaveBeenCalledWith('# HELP http_requests_total test\n');
    });
});
