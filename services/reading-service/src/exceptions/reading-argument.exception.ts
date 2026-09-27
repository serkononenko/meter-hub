import {HttpException, HttpStatus} from "@nestjs/common";


export class ReadingDecreasingException extends HttpException {
    constructor(pendingValue: number, previousValue: number, previousRecordedAt: string) {
        super({
            code: 'READING_DECREASING',
            title: 'Reading is lower than the previous one',
            detail:
                `The value ${pendingValue} is lower than the previous reading ` +
                `${previousValue} recorded at ${previousRecordedAt}. ` +
                'Cumulative meter counters must not decrease.',
            errors: [
                {field: 'value', message: 'must not be lower than the previous reading'},
            ],
        }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}

export class RecordedAtInFutureException extends HttpException {
    constructor(recordedAt: string) {
        super({
            code: 'RECORDED_AT_IN_FUTURE',
            title: 'Reading timestamp is in the future',
            detail:
                `The recordedAt ${recordedAt} is in the future; ` +
                'readings cannot be recorded ahead of time.',
            errors: [
                {field: 'recordedAt', message: 'must not be in the future'},
            ],
        }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}

export class RecordedAtTooOldException extends HttpException {
    constructor(recordedAt: string, maxAgeYears: number) {
        super({
            code: 'RECORDED_AT_TOO_OLD',
            title: 'Reading timestamp is too far in the past',
            detail:
                `The recordedAt ${recordedAt} is more than ${maxAgeYears} years in the past; ` +
                `the plausible window for utility readings is ${maxAgeYears} years.`,
            errors: [
                {field: 'recordedAt', message: `must not be older than ${maxAgeYears} years`},
            ],
        }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
