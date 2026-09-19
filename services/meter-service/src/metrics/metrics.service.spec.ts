import {describe, expect, it, beforeEach} from 'vitest';
import {MetricsService} from './metrics.service.js';

describe('MetricsService', () => {
    let service: MetricsService;

    beforeEach(() => {
        service = new MetricsService();
    });

    it('counts requests by method, path and status', async () => {
        service.observeRequest('GET', '/api/v1/meters', 200, 12);
        service.observeRequest('GET', '/api/v1/meters', 200, 15);
        service.observeRequest('POST', '/api/v1/meters', 201, 40);

        const output = await service.scrape();
        expect(output).toContain('http_requests_total{method="GET",path="/api/v1/meters",status="200"} 2');
        expect(output).toContain('http_requests_total{method="POST",path="/api/v1/meters",status="201"} 1');
    });

    it('counts errors via the status label without a separate metric', async () => {
        service.observeRequest('GET', '/api/v1/meters', 500, 5);

        const output = await service.scrape();
        expect(output).toContain('http_requests_total{method="GET",path="/api/v1/meters",status="500"} 1');
    });

    it('records latency observations in the histogram', async () => {
        service.observeRequest('GET', '/api/v1/meters', 200, 250);

        const output = await service.scrape();
        expect(output).toContain('http_request_duration_seconds_count{method="GET",path="/api/v1/meters",status="200"} 1');
        expect(output).toMatch(/http_request_duration_seconds_bucket\{.*le="0\.25".*\} 1/);
    });

    it('strips query strings from the path label', async () => {
        service.observeRequest('GET', '/api/v1/meters?limit=10&offset=0', 200, 8);

        const output = await service.scrape();
        expect(output).toContain('path="/api/v1/meters"');
        expect(output).not.toContain('limit=10');
    });

    it('exposes default process metrics', async () => {
        const output = await service.scrape();
        expect(output).toContain('nodejs_');
        expect(output).toContain('process_cpu_');
    });
});
