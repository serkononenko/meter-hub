/**
 * Normalizes paging bounds: defaults per the contract, and out-of-range or
 * non-numeric input falls back to the defaults rather than erroring — GET
 * history is a browsing surface, not a form. Query parameters arrive as
 * strings, so numeric-looking values are coerced.
 */

const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 200;

export function clampPage(limit: number | string | undefined, offset: number | string | undefined): { limit: number; offset: number } {
    return {limit: clampLimit(limit), offset: clampOffset(offset)};
}

function clampLimit(limit: number | string | undefined): number {
    const value = typeof limit === 'string' ? Number(limit) : limit;
    return typeof value === 'number' && Number.isFinite(value) && value >= 1
        ? Math.min(Math.floor(value), MAX_HISTORY_LIMIT)
        : DEFAULT_HISTORY_LIMIT;
}

function clampOffset(offset: number | string | undefined): number {
    const value = typeof offset === 'string' ? Number(offset) : offset;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : 0;
}
