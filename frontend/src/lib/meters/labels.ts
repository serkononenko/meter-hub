/**
 * Human-readable labels and formatting for meter enums. Values mirror the
 * generated meter-service models.
 */
import type {MeterStatus, MeterType, MeterUnit} from "@/lib/api/generated/meter-service/model";

export const meterTypeLabels: Record<MeterType, string> = {
  ELECTRICITY: "Electricity",
  GAS: "Gas",
  COLD_WATER: "Cold water",
  HOT_WATER: "Hot water",
};

export const meterUnitLabels: Record<MeterUnit, string> = {
  KWH: "kWh",
  M3: "m³",
  L: "l",
};

export const meterStatusLabels: Record<MeterStatus, string> = {
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

/** Sensible unit options per meter type, most common first. */
export const meterUnitsByType: Record<MeterType, MeterUnit[]> = {
  ELECTRICITY: ["KWH"],
  GAS: ["M3"],
  COLD_WATER: ["M3", "L"],
  HOT_WATER: ["M3", "L"],
};

/** Formats a reading counter value in the meter's unit. */
export function formatReadingValue(value: number, unit: MeterUnit): string {
  return `${value.toLocaleString(undefined, {maximumFractionDigits: 3})} ${meterUnitLabels[unit]}`;
}
