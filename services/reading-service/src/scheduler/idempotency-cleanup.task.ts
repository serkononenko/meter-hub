import {Injectable, Logger} from '@nestjs/common';
import {Cron, CronExpression} from '@nestjs/schedule';

import {IdempotencyKeyRepository} from '../reading/idempotency-key.repository.js';

/**
 * Drops idempotency records past their retention window.
 * Expired records are harmless to keep — replay lookups only match live
 * keys — so this is housekeeping, not correctness: the hourly cadence
 * just bounds table growth. Failures are logged and retried next tick.
 */
@Injectable()
export class IdempotencyCleanupTask {
    private readonly logger = new Logger(IdempotencyCleanupTask.name);

    constructor(private readonly idempotencyKeys: IdempotencyKeyRepository) {}

    @Cron(CronExpression.EVERY_HOUR)
    async handleCleanup(): Promise<void> {
        try {
            const deleted = await this.idempotencyKeys.deleteExpired(new Date());
            if (deleted > 0) {
                this.logger.log(`Deleted ${deleted} expired idempotency record(s)`);
            }
        } catch (error) {
            this.logger.error(
                'Idempotency cleanup failed; retrying next tick',
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
