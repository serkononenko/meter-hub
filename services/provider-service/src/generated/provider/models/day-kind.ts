

export const DayKind = {
    DAY_OF_MONTH: 'DAY_OF_MONTH',
    LAST_DAY: 'LAST_DAY',
} as const;
export type DayKind = typeof DayKind[keyof typeof DayKind];

