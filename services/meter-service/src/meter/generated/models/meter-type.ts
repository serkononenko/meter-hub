

/**
 * Physical kind of the meter.
 */
export const MeterType = {
    ELECTRICITY: 'ELECTRICITY',
    GAS: 'GAS',
    COLD_WATER: 'COLD_WATER',
    HOT_WATER: 'HOT_WATER',
} as const;
export type MeterType = typeof MeterType[keyof typeof MeterType];

