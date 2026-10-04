import {Injectable, Logger} from '@nestjs/common';
import {Cron, CronExpression} from '@nestjs/schedule';
import {PrismaIdempotencyStore} from '../reading/idempotency.store.js';


@Injectable()
export class IdempotencyCleanupTask {
    private readonly logger = new Logger(IdempotencyCleanupTask.name);

    constructor(private readonly idempotencyStore: PrismaIdempotencyStore) {}

    @Cron(CronExpression.EVERY_HOUR)
    async handleCleanup(): Promise<void> {
        try {
            const deleted = await this.idempotencyStore.prune();
            if (deleted > 0) {
                this.logger.log(`Pruned ${deleted} expired idempotency record(s)`);
            }
        } catch (error) {
            this.logger.error(
                'Idempotency cleanup failed; retrying next tick',
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
