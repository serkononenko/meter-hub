

/**
 * GLOBAL entries form the admin-curated catalog; HOUSEHOLD providers are private to one household.
 */
export const ProviderScope = {
    GLOBAL: 'GLOBAL',
    HOUSEHOLD: 'HOUSEHOLD',
} as const;
export type ProviderScope = typeof ProviderScope[keyof typeof ProviderScope];

