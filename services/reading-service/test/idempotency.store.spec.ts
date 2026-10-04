import {afterEach, beforeAll, beforeEach, describe, it, vi} from 'vitest';
import {IdempotencyStorage, IdempotencyModule} from '@nestjs/idempotency';
import {idempotencyStoreContract} from '@nestjs/idempotency/testing';
import {Test} from '@nestjs/testing';
import {PrismaIdempotencyStore} from '../src/reading/idempotency.store.js';
import {PrismaService} from '../src/database/prisma.service.js';

/**
 * PrismaIdempotencyStore against the package's own contract suite
 * (backlog A5). Requires the local Postgres (docker compose up postgres):
 * the store's guarantees are statement-level atomicity, so a stub can't
 * prove them. Concurrent mode races 16 callers per key — a two-step
 * read-then-write store fails these.
 */
const DATABASE_URL = process.env.DATABASE_URL
    ?? 'postgresql://reading_user:reading_dev@localhost:5432/reading_db';

let store: PrismaIdempotencyStore;
let prisma: PrismaService;
let storage: IdempotencyStorage;

beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [IdempotencyModule.forRoot({isGlobal: true})],
        providers: [
            {
                provide: PrismaService,
                useValue: new PrismaService({
                    getOrThrow: (key: string) => {
                        if (key === 'database.url') {
                            return DATABASE_URL;
                        }
                        throw new Error(`Unexpected config key ${key}`);
                    },
                } as never),
            },
        ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    storage = moduleRef.get(IdempotencyStorage);
    store = new PrismaIdempotencyStore(prisma, storage);
}, 30_000);

beforeEach(async () => {
    // Contract cases use their own random key prefixes, but a leaked row
    // from a crashed run shouldn't fail the next one.
    await prisma.$executeRaw`TRUNCATE TABLE "idempotency_keys"`;
    vi.useFakeTimers({toFake: ['Date']});
});

afterEach(() => {
    vi.useRealTimers();
});

describe('PrismaIdempotencyStore contract', () => {
    const cases = idempotencyStoreContract(() => store, {
        concurrent: true,
        advanceTime: (ms) => vi.setSystemTime(Date.now() + ms),
    });

    for (const c of cases) {
        it(c.name, () => c.run());
    }
});
