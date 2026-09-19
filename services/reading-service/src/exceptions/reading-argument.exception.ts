import {HttpException, HttpStatus} from "@nestjs/common";


/**
 * The request is well-formed but the reading is business-invalid (PRD §7):
 * for cumulative meters the counter must not go backwards. 422 per
 * api-conventions §5; the code is a stable machine-readable contract.
 */
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
