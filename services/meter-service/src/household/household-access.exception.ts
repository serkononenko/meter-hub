export class HouseholdAccessException extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message, {cause});
        this.name = 'HouseholdAccessException';
    }
}
