export type DayKind = 'DAY_OF_MONTH' | 'LAST_DAY';

export interface DaySpec {
    kind: DayKind;
    day?: number;
    offsetDays?: number;
}

export interface SubmissionRule {
    cycle: 'MONTHLY';
    opens: DaySpec;
    closes: DaySpec;
    timezone: string;
}

export interface CycleMonth {
    year: number;
    month: number;
}

export interface SubmissionWindow {
    opensAt: Date;
    closesAt: Date;
}
