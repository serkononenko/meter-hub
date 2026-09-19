import {afterEach, describe, expect, it, vi} from 'vitest';
import {CURRENT_CORRELATION_ID} from '../middlewares/correlation.middleware.js';
import {StructuredLoggerService} from './structured-logger.service.js';

describe('StructuredLoggerService', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    afterEach(() => {
        stdout.mockClear();
    });

    it('emits one JSON line with the conventions §14 fields', () => {
        const logger = new StructuredLoggerService();

        logger.log('Reading created');

        expect(stdout).toHaveBeenCalledTimes(1);
        const line = JSON.parse(stdout.mock.calls[0][0] as string) as Record<string, unknown>;
        expect(line.service).toBe('reading-service');
        expect(line.level).toBe('INFO');
        expect(line.message).toBe('Reading created');
        expect(line.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(line.requestId).toBeNull();
    });

    it('carries the correlation ID as requestId inside request scope', () => {
        const logger = new StructuredLoggerService();

        CURRENT_CORRELATION_ID.run('7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10', () => {
            logger.warn('Ownership could not be verified');
        });

        const line = JSON.parse(stdout.mock.calls[0][0] as string) as Record<string, unknown>;
        expect(line.requestId).toBe('7d6f5f2c-0a49-4e10-8ef7-7c3d2b1f4a10');
        expect(line.level).toBe('WARN');
    });

    it('includes structured fields alongside the message', () => {
        const logger = new StructuredLoggerService();

        logger.error('Unhandled exception', {path: '/api/v1/meters', status: 500});

        const line = JSON.parse(stdout.mock.calls[0][0] as string) as Record<string, unknown>;
        expect(line.level).toBe('ERROR');
        expect(line.fields).toEqual({path: '/api/v1/meters', status: 500});
    });

    it('filters below the configured threshold', () => {
        const logger = new StructuredLoggerService('warn');

        logger.log('hidden info');
        logger.debug('hidden debug');
        logger.warn('shown warning');

        expect(stdout).toHaveBeenCalledTimes(1);
        const line = JSON.parse(stdout.mock.calls[0][0] as string) as Record<string, unknown>;
        expect(line.message).toBe('shown warning');
    });

    it('escapes nothing that would break the JSON line', () => {
        const logger = new StructuredLoggerService();

        logger.log('bad "message" with \\ backslash');

        const line = JSON.parse(stdout.mock.calls[0][0] as string) as Record<string, unknown>;
        expect(line.message).toBe('bad "message" with \\ backslash');
    });
});
