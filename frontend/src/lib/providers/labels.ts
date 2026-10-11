/**
 * Human-readable labels and formatting for provider enums and submission
 * windows. Values mirror the generated provider-service models.
 */
import type {
  DayKind,
  DaySpec,
  MeterSubmissionWindows,
  ProviderScope,
  SubmissionRule,
  SubmissionWindow,
} from "@/lib/api/generated/provider-service/model";

export const providerScopeLabels: Record<ProviderScope, string> = {
  GLOBAL: "Catalog",
  HOUSEHOLD: "Private",
};

export const dayKindLabels: Record<DayKind, string> = {
  DAY_OF_MONTH: "day of month",
  LAST_DAY: "last day",
};

const MONTH_DAY_OPTIONS: Intl.DateTimeFormatOptions = {day: "numeric", month: "long"};

/** Formats an opening/closing instant as "5 March". */
export function formatWindowDay(instant: string): string {
  return new Date(instant).toLocaleDateString(undefined, MONTH_DAY_OPTIONS);
}

/** Formats a window as "5 – 28 March" or "28 March – 5 April" across months. */
export function formatWindowRange(window: Pick<SubmissionWindow, "closesAt" | "opensAt">): string {
  const opens = new Date(window.opensAt);
  const closes = new Date(window.closesAt);
  const sameMonth =
    opens.getMonth() === closes.getMonth() && opens.getFullYear() === closes.getFullYear();
  if (sameMonth) {
    return `${opens.getDate()} – ${formatWindowDay(window.closesAt)}`;
  }
  return `${formatWindowDay(window.opensAt)} – ${formatWindowDay(window.closesAt)}`;
}

/**
 * Renders a rule in plain language, the way a person would describe it:
 * "opens on the 1st, closes on the last day of the month".
 */
export function formatRuleInWords(rule: SubmissionRule): string {
  return `opens ${describeDay(rule.opens)}, closes ${describeDay(rule.closes)}`;
}

function describeDay(spec: DaySpec): string {
  if (spec.kind === "LAST_DAY") {
    return spec.offsetDays
      ? `${spec.offsetDays} ${dayOffsetNoun(spec.offsetDays)} before the end of the month`
      : "on the last day of the month";
  }
  return spec.day === 1 ? "on the 1st" : `on day ${spec.day} of the month`;
}

function dayOffsetNoun(offsetDays: number): string {
  return offsetDays === 1 ? "day" : "days";
}

/**
 * Status of the window that matters right now: open, upcoming, or none.
 * The API returns current/next for the requested instant; this adds the
 * is-it-open answer for styling and copy.
 */
export interface WindowStatus {
  window: SubmissionWindow;
  state: "open" | "upcoming";
  endsInDays: number;
  startsInDays: number;
}

export function windowStatusOf(windows: MeterSubmissionWindows): WindowStatus | null {
  const now = Date.now();
  if (windows.current) {
    return {
      window: windows.current,
      state: "open",
      endsInDays: daysUntil(windows.current.closesAt, now),
      startsInDays: 0,
    };
  }
  if (windows.next) {
    return {
      window: windows.next,
      state: "upcoming",
      endsInDays: daysUntil(windows.next.closesAt, now),
      startsInDays: daysUntil(windows.next.opensAt, now),
    };
  }
  return null;
}

function daysUntil(instant: string, now: number): number {
  return Math.ceil((new Date(instant).getTime() - now) / 86_400_000);
}
