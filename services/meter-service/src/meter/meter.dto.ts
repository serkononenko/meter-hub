import type { MeterStatus, MeterType, MeterUnit } from '../database/generated/prisma/enums.js';
import { METER_STATUSES, METER_TYPES, METER_UNITS } from './meter.model.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A single field-level validation problem (api-conventions §5 `errors[]`). */
export interface FieldError {
  field: string;
  message: string;
}

export class RequestValidationError extends Error {
  constructor(public readonly errors: FieldError[]) {
    super('One or more request fields are invalid.');
    this.name = 'RequestValidationError';
  }
}

export interface CreateMeterDto {
  householdId: string;
  type: MeterType;
  name: string;
  serialNumber: string;
  unit: MeterUnit;
}

export interface UpdateMeterDto {
  name?: string;
  serialNumber?: string;
  unit?: MeterUnit;
  status?: MeterStatus;
}

const NAME_MAX = 200;
const SERIAL_NUMBER_MAX = 100;

/**
 * Validates a create-meter request body. All field errors are collected (not
 * fail-fast) so clients see the full set of problems in one round trip.
 */
export function parseCreateMeter(body: unknown): CreateMeterDto {
  const record = requireRecord(body);
  const errors: FieldError[] = [];

  const householdId = requireUuid(record, 'householdId', errors);
  const type = requireEnum(record, 'type', METER_TYPES, errors);
  const name = requireString(record, 'name', NAME_MAX, errors);
  const serialNumber = requireString(record, 'serialNumber', SERIAL_NUMBER_MAX, errors);
  const unit = requireEnum(record, 'unit', METER_UNITS, errors);

  throwIfErrors(errors);
  return { householdId, type, name, serialNumber, unit };
}

/** Validates a patch-meter request body; at least one field must be present. */
export function parseUpdateMeter(body: unknown): UpdateMeterDto {
  const record = requireRecord(body);
  const errors: FieldError[] = [];
  if (Object.keys(record).length === 0) {
    errors.push({ field: 'body', message: 'must contain at least one updatable field' });
  }
  if ('householdId' in record) {
    errors.push({ field: 'householdId', message: 'a meter cannot be moved between households' });
  }

  const dto: UpdateMeterDto = {};
  const name = requireOptionalString(record, 'name', NAME_MAX, errors);
  if (name !== undefined) dto.name = name;
  const serialNumber = requireOptionalString(record, 'serialNumber', SERIAL_NUMBER_MAX, errors);
  if (serialNumber !== undefined) dto.serialNumber = serialNumber;
  const unit = requireOptionalEnum(record, 'unit', METER_UNITS, errors);
  if (unit !== undefined) dto.unit = unit;
  const status = requireOptionalEnum(record, 'status', METER_STATUSES, errors);
  if (status !== undefined) dto.status = status;

  throwIfErrors(errors);
  return dto;
}

export function parseUuidParam(value: string | undefined, field: string): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new RequestValidationError([{ field, message: 'must be a UUID' }]);
  }
  return value.toLowerCase();
}

function throwIfErrors(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw new RequestValidationError(errors);
  }
}

function requireRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new RequestValidationError([{ field: 'body', message: 'must be a JSON object' }]);
  }
  return body as Record<string, unknown>;
}

function requireString(
  record: Record<string, unknown>,
  field: string,
  maxLength: number,
  errors: FieldError[],
): string {
  const value = requireOptionalString(record, field, maxLength, errors);
  if (value === undefined) {
    return '';
  }
  return value;
}

function requireOptionalString(
  record: Record<string, unknown>,
  field: string,
  maxLength: number,
  errors: FieldError[],
): string | undefined {
  if (!(field in record)) {
    return undefined;
  }
  const value = record[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push({ field, message: 'must not be blank' });
    return undefined;
  }
  if (value.length > maxLength) {
    errors.push({ field, message: `must be at most ${maxLength} characters` });
    return undefined;
  }
  return value;
}

function requireEnum<E extends string>(
  record: Record<string, unknown>,
  field: string,
  allowed: readonly E[],
  errors: FieldError[],
): E {
  const value = requireOptionalEnum(record, field, allowed, errors);
  if (value === undefined) {
    return '' as E;
  }
  return value;
}

function requireOptionalEnum<E extends string>(
  record: Record<string, unknown>,
  field: string,
  allowed: readonly E[],
  errors: FieldError[],
): E | undefined {
  if (!(field in record)) {
    return undefined;
  }
  const value = record[field];
  if (typeof value !== 'string' || !allowed.includes(value as E)) {
    errors.push({ field, message: `must be one of: ${allowed.join(', ')}` });
    return undefined;
  }
  return value as E;
}

function requireUuid(
  record: Record<string, unknown>,
  field: string,
  errors: FieldError[],
): string {
  const value = record[field];
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    errors.push({ field, message: 'must be a UUID' });
    return '';
  }
  return value.toLowerCase();
}
