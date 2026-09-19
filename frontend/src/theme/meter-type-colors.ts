/**
 * Meter-type colors of the identity: each physical meter kind owns a hue
 * (electricity violet, gas amber, cold-water blue, hot-water red). Meter
 * and reading UI (tasks 7.4/7.5) must use these rather than the theme
 * primary, so color encodes the meter type wherever a meter appears.
 */

export type MeterTypeValue = "ELECTRICITY" | "GAS" | "COLD_WATER" | "HOT_WATER";

export const meterTypeColors: Record<MeterTypeValue, string> = {
  ELECTRICITY: "#635bff",
  GAS: "#fb9c0c",
  COLD_WATER: "#04aad6",
  HOT_WATER: "#f04438",
};

const isMeterType = (value: string): value is MeterTypeValue =>
  value in meterTypeColors;

/** Color for a meter type value; falls back to neutral ink for unknowns. */
export function meterTypeColor(value: string): string {
  return isMeterType(value) ? meterTypeColors[value] : "#4b5f75";
}
