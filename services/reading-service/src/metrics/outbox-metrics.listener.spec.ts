import {describe, expect, it} from 'vitest';
import {OutboxMetricsListener} from './outbox-metrics.listener.js';
import {MetricsService} from './metrics.service.js';

/**
 * The listener is the translation layer between outbox domain events and
 * the `reading_outbox_*` series — these tests pin the mapping.
 */
describe('OutboxMetricsListener', () => {
    it('maps domain events onto the reading_outbox_* series', async () => {
        const metrics = new MetricsService();
        const listener = new OutboxMetricsListener(metrics);

        listener.onRoundCompleted({backlog: 3});
        listener.onBatchPublished({count: 2});
        listener.onPublishFailed({eventId: 'e1'});
        listener.onRoundFailed({reason: 'db down'});

        const text = await metrics.scrape();
        expect(text).toContain('reading_outbox_unpublished 3');
        expect(text).toContain('reading_outbox_published_total 2');
        expect(text).toContain('reading_outbox_publish_errors_total 1');
        expect(text).toContain('reading_outbox_round_errors_total 1');
    });

    it('starts every series at zero before any event arrives', async () => {
        const metrics = new MetricsService();
        new OutboxMetricsListener(metrics);

        const text = await metrics.scrape();
        expect(text).toContain('reading_outbox_unpublished 0');
        expect(text).toContain('reading_outbox_published_total 0');
        expect(text).toContain('reading_outbox_publish_errors_total 0');
        expect(text).toContain('reading_outbox_round_errors_total 0');
    });
});
