import {registerDecorator} from 'class-validator';

import type {ValidationOptions} from 'class-validator';


const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: unknown): value is string {
    if (typeof value !== 'string') {
        return false;
    }

    const match = DATE_PATTERN.exec(value);
    if (!match) {
        return false;
    }

    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const parsed = new Date(Date.UTC(year, month - 1, day));

    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
    return (target, propertyName) => {
        registerDecorator({
            name: 'isCalendarDate',
            target: target.constructor,
            propertyName: propertyName as string,
            options: {message: `${String(propertyName)} must be a calendar date (YYYY-MM-DD)`, ...options},
            validator: {validate: isCalendarDate},
        });
    };
}
