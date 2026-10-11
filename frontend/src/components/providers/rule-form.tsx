"use client";

import * as React from "react";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {DayKind} from "@/lib/api/generated/provider-service/model";
import type {SubmissionRule} from "@/lib/api/generated/provider-service/model";
import {COMMON_TIMEZONES, daySpecSchema} from "@/lib/providers/rule-schema";
import {formatRuleInWords} from "@/lib/providers/labels";

export interface RuleFormValue {
  opensKind: DayKind;
  opensDay: string;
  opensOffset: string;
  closesKind: DayKind;
  closesDay: string;
  closesOffset: string;
  timezone: string;
}

export const emptyRuleForm: RuleFormValue = {
  opensKind: DayKind.DAY_OF_MONTH,
  opensDay: "1",
  opensOffset: "0",
  closesKind: DayKind.DAY_OF_MONTH,
  closesDay: "20",
  closesOffset: "0",
  timezone: "Europe/Kyiv",
};

/** Prefills the form from an API rule, e.g. a provider's defaultRule. */
export function ruleFormFrom(rule: SubmissionRule): RuleFormValue {
  return {
    opensKind: rule.opens.kind,
    opensDay: String(rule.opens.day ?? ""),
    opensOffset: String(rule.opens.offsetDays ?? 0),
    closesKind: rule.closes.kind,
    closesDay: String(rule.closes.day ?? ""),
    closesOffset: String(rule.closes.offsetDays ?? 0),
    timezone: rule.timezone,
  };
}

/**
 * Submission-window rule editor shared by the account editor and the
 * catalog admin screen. Validates with the shared zod schema on submit
 * and hands back the API shape via onValid.
 */
export function RuleForm({value, onChange}: {value: RuleFormValue; onChange: (next: RuleFormValue) => void}): React.JSX.Element {
  const [error, setError] = React.useState<string | null>(null);

  const preview = React.useMemo(() => {
    const parsed = parseRuleForm(value);
    return parsed.rule ? formatRuleInWords(parsed.rule) : null;
  }, [value]);

  const set = (patch: Partial<RuleFormValue>): void => {
    onChange({...value, ...patch});
    setError(null);
  };

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary" variant="body2">
        When does this provider expect readings each month?
      </Typography>
      <Stack direction="row" spacing={2}>
        <DayFields
          dayValue={value.opensDay}
          error={error}
          kindValue={value.opensKind}
          label="Opens"
          offsetValue={value.opensOffset}
          onDayChange={(day) => set({opensDay: day})}
          onKindChange={(kind) => set({opensKind: kind})}
          onOffsetChange={(offset) => set({opensOffset: offset})}
        />
        <DayFields
          dayValue={value.closesDay}
          error={error}
          kindValue={value.closesKind}
          label="Closes"
          offsetValue={value.closesOffset}
          onDayChange={(day) => set({closesDay: day})}
          onKindChange={(kind) => set({closesKind: kind})}
          onOffsetChange={(offset) => set({closesOffset: offset})}
        />
      </Stack>
      <TimeZoneField error={error} value={value.timezone} onChange={(timezone) => set({timezone})} />
      {preview ? (
        <>
          <Divider />
          <Typography variant="body2">
            Monthly window {preview}.
          </Typography>
        </>
      ) : null}
      {error ? <FormHelperText error>{error}</FormHelperText> : null}
    </Stack>
  );
}

/** Validates the form; returns the API rule or an error message. */
export function parseRuleForm(value: RuleFormValue): {rule?: import("@/lib/api/generated/provider-service/model").SubmissionRule; error?: string} {
  const opens = daySpecSchema.safeParse(
    value.opensKind === DayKind.DAY_OF_MONTH
      ? {kind: value.opensKind, day: value.opensDay}
      : {kind: value.opensKind, offsetDays: value.opensOffset},
  );
  if (!opens.success) {
    return {error: "Check the opening day — it must be between 1 and 31."};
  }
  const closes = daySpecSchema.safeParse(
    value.closesKind === DayKind.DAY_OF_MONTH
      ? {kind: value.closesKind, day: value.closesDay}
      : {kind: value.closesKind, offsetDays: value.closesOffset},
  );
  if (!closes.success) {
    return {error: "Check the closing day — offsets go from 0 to 27 days before month end."};
  }
  return {
    rule: {
      cycle: "MONTHLY",
      opens: opens.data,
      closes: closes.data,
      timezone: value.timezone,
    },
  };
}

function DayFields({dayValue, error, kindValue, label, offsetValue, onDayChange, onKindChange, onOffsetChange}: {
  dayValue: string;
  error: string | null;
  kindValue: DayKind;
  label: string;
  offsetValue: string;
  onDayChange: (day: string) => void;
  onKindChange: (kind: DayKind) => void;
  onOffsetChange: (offset: string) => void;
}): React.JSX.Element {
  return (
    <Stack spacing={2} sx={{flex: 1}}>
      <FormControl>
        <InputLabel>{label}</InputLabel>
        <Select
          label={label}
          onChange={(event) => onKindChange(event.target.value as DayKind)}
          value={kindValue}
        >
          <MenuItem value={DayKind.DAY_OF_MONTH}>On day of month</MenuItem>
          <MenuItem value={DayKind.LAST_DAY}>Days before month end</MenuItem>
        </Select>
      </FormControl>
      {kindValue === DayKind.DAY_OF_MONTH ? (
        <FormControl error={Boolean(error)} fullWidth>
          <InputLabel>Day</InputLabel>
          <OutlinedInput
            inputProps={{max: 31, min: 1}}
            label="Day"
            onChange={(event) => onDayChange(event.target.value)}
            type="number"
            value={dayValue}
          />
          <FormHelperText>1–31; later days clamp to the month&apos;s last day</FormHelperText>
        </FormControl>
      ) : (
        <FormControl error={Boolean(error)} fullWidth>
          <InputLabel>Days before end</InputLabel>
          <OutlinedInput
            inputProps={{max: 27, min: 0}}
            label="Days before end"
            onChange={(event) => onOffsetChange(event.target.value)}
            type="number"
            value={offsetValue}
          />
          <FormHelperText>0 = the last day of the month</FormHelperText>
        </FormControl>
      )}
    </Stack>
  );
}

function TimeZoneField({error, value, onChange}: {error: string | null; value: string; onChange: (next: string) => void}): React.JSX.Element {
  return (
    <FormControl error={Boolean(error)} fullWidth>
      <InputLabel>Time zone</InputLabel>
      <Select
        label="Time zone"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {COMMON_TIMEZONES.map((zone) => (
          <MenuItem key={zone} value={zone}>
            {zone}
          </MenuItem>
        ))}
      </Select>
      {error ? <FormHelperText error>{error}</FormHelperText> : null}
    </FormControl>
  );
}
