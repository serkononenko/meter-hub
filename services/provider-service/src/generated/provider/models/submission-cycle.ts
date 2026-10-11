

/**
 * Only monthly windows are accepted for now.
 */
export const SubmissionCycle = {
    MONTHLY: 'MONTHLY',
} as const;
export type SubmissionCycle = typeof SubmissionCycle[keyof typeof SubmissionCycle];

