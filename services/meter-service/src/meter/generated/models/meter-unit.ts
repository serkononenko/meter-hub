

/**
 * Unit the meter\'s readings are recorded in.
 */
export const MeterUnit = {
    KWH: 'KWH',
    M3: 'M3',
    L: 'L',
} as const;
export type MeterUnit = typeof MeterUnit[keyof typeof MeterUnit];

