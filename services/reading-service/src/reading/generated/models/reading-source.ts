

/**
 * How the reading entered the system. MVP records MANUAL entries only.
 */
export const ReadingSource = {
    MANUAL: 'MANUAL',
} as const;
export type ReadingSource = typeof ReadingSource[keyof typeof ReadingSource];

