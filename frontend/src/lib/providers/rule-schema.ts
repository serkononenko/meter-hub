import {z} from "zod";

import {DayKind, SubmissionCycle} from "@/lib/api/generated/provider-service/model";

/**
 * Form-level schema for a submission rule. The API accepts DAY_OF_MONTH
 * days 1–31 (clamped to the month's length) and LAST_DAY offsets 0–27;
 * the provider service validates that consecutive windows don't overlap,
 * which a form can only check per-rule, not per-provider.
 */
export const daySpecSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(DayKind.DAY_OF_MONTH),
    day: z.coerce.number().int().min(1).max(31),
  }),
  z.object({
    kind: z.literal(DayKind.LAST_DAY),
    offsetDays: z.coerce.number().int().min(0).max(27).default(0),
  }),
]);

export const submissionRuleSchema = z.object({
  cycle: z.literal(SubmissionCycle.MONTHLY),
  opens: daySpecSchema,
  closes: daySpecSchema,
  timezone: z.string().min(1),
});

export type SubmissionRuleForm = z.infer<typeof submissionRuleSchema>;

/** Timezones offered in the rule form; the MVP audience is Ukraine-based. */
export const COMMON_TIMEZONES = [
  "Europe/Kyiv",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Warsaw",
  "UTC",
] as const;

/** Builds the API shape from validated form values (zod defaults applied). */
export function toApiRule(form: SubmissionRuleForm) {
  return {
    cycle: form.cycle,
    opens:
      form.opens.kind === DayKind.DAY_OF_MONTH
        ? {kind: form.opens.kind, day: form.opens.day}
        : {kind: form.opens.kind, offsetDays: form.opens.offsetDays ?? 0},
    closes:
      form.closes.kind === DayKind.DAY_OF_MONTH
        ? {kind: form.closes.kind, day: form.closes.day}
        : {kind: form.closes.kind, offsetDays: form.closes.offsetDays ?? 0},
    timezone: form.timezone,
  };
}
