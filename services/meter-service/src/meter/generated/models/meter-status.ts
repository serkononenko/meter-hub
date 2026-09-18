

/**
 * Lifecycle status. Archiving keeps historical readings addressable.
 */
export const MeterStatus = {
    ACTIVE: 'ACTIVE',
    ARCHIVED: 'ARCHIVED',
} as const;
export type MeterStatus = typeof MeterStatus[keyof typeof MeterStatus];

