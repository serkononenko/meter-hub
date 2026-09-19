"use client";

import * as React from "react";
import {useQueryClient} from "@tanstack/react-query";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {fieldErrorsOf, isErrorResponse} from "@/lib/api/problems";
import {
  getGetLatestReadingQueryKey,
  getLatestReading,
  getListReadingsQueryKey,
  useCreateReading,
  useGetLatestReading,
} from "@/lib/api/generated/reading-service";
import {formatReadingValue, meterUnitLabels} from "@/lib/meters/labels";
import {meterTypeColor} from "@/theme/meter-type-colors";
import type {Meter} from "@/lib/api/generated/meter-service/model";

export interface ReadingCreateDialogProps {
  meter: Meter;
  onClose: () => void;
  open: boolean;
}

interface Values {
  value: string;
  recordedAt: string;
}

/** Local datetime input value → RFC 3339 UTC with Z suffix. */
function toUtcIso(localValue: string): string | null {
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Current moment as a `datetime-local` input value, minute precision. */
function localDateTimeNow(): string {
  const now = new Date();
  const pad = (part: number): string => String(part).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}`
  );
}

/**
 * Modal form for manually recording a reading of a meter. The value field
 * is styled as the counter itself — large right-aligned digits with the
 * unit alongside — because recording a reading is transcribing the meter
 * face. Cumulative counters must not go backwards: the last reading is
 * shown as the floor, and the backend's 422 lands on the input as well.
 */
export function ReadingCreateDialog({meter, onClose, open}: ReadingCreateDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const createReadingMutation = useCreateReading();
  const latestQuery = useGetLatestReading(meterId(meter), {query: {enabled: open}});
  const latest = latestReadingOf(latestQuery.data);

  const [values, setValues] = React.useState<Values>({value: "", recordedAt: localDateTimeNow()});
  const [errors, setErrors] = React.useState<Partial<Record<keyof Values, string>>>({});
  const [lastMeter, setLastMeter] = React.useState<Meter>(meter);
  const [lastOpen, setLastOpen] = React.useState(open);

  // Fresh form per opened meter and per reopening (reset during render).
  if (meter !== lastMeter || (!open && lastOpen)) {
    setLastMeter(meter);
    setLastOpen(open);
    setValues({value: "", recordedAt: localDateTimeNow()});
    setErrors({});
  }

  const meterColor = meterTypeColor(meter.type);
  const floor =
    latest != null
      ? {
          value: latest.value,
          recordedAt: new Date(latest.recordedAt),
        }
      : null;

  const handleClose = (): void => {
    onClose();
  };

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();

      const nextErrors: typeof errors = {};
      const value = Number(values.value.replace(",", "."));
      if (!values.value.trim()) {
        nextErrors.value = "Enter the counter value.";
      } else if (Number.isNaN(value) || value < 0) {
        nextErrors.value = "The counter value can't be negative.";
      } else if (floor && value < floor.value) {
        nextErrors.value =
          `The counter was at ${formatReadingValue(floor.value, meter.unit)} on ` +
          `${floor.recordedAt.toLocaleDateString(undefined, {dateStyle: "medium"})}. ` +
          "Enter a value at least that high.";
      }
      if (!values.recordedAt) {
        nextErrors.recordedAt = "Enter the date and time of the reading.";
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      const recordedAtIso = toUtcIso(values.recordedAt);
      if (!recordedAtIso) {
        setErrors({recordedAt: "Enter a valid date and time."});
        return;
      }

      const response = await createReadingMutation.mutateAsync({
        data: {meterId: meter.id, value, recordedAt: recordedAtIso},
      });

      if (isErrorResponse(response)) {
        const fieldErrors = fieldErrorsOf(response.data);
        setErrors({
          value:
            fieldErrors.value ??
            (response.status === 422
              ? `Enter a value at least as high as the last reading.`
              : (response.data.detail ?? response.data.title ?? "The reading could not be saved.")),
          recordedAt: fieldErrors.recordedAt,
        });
        return;
      }

      await queryClient.invalidateQueries({queryKey: getGetLatestReadingQueryKey(meter.id)});
      await queryClient.invalidateQueries({queryKey: getListReadingsQueryKey(meter.id)});
      onClose();
  };

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="xs" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>Record reading</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{mb: 3}}>
            Enter the counter value shown on {meter.name}.
          </DialogContentText>
          <Stack spacing={2.5}>
            <FormControl error={Boolean(errors.value)} fullWidth>
              <InputLabel>Counter value</InputLabel>
              <OutlinedInput
                endAdornment={
                  <InputAdornment position="end" sx={{alignSelf: "center", position: "static", transform: "none"}}>
                    <Typography color="text.secondary" variant="body2">
                      {meterUnitLabels[meter.unit]}
                    </Typography>
                  </InputAdornment>
                }
                inputProps={{inputMode: "decimal"}}
                label="Counter value"
                name="value"
                onChange={(event) => {
                  setValues((prev) => ({...prev, value: event.target.value}));
                  setErrors((prev) => ({...prev, value: undefined}));
                }}
                placeholder="0"
                sx={{
                  "& .MuiOutlinedInput-input": {
                    fontFamily: "var(--font-spline-mono), monospace",
                    fontSize: "1.5rem",
                    fontWeight: 500,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    paddingTop: "20px",
                    paddingBottom: "20px",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {borderColor: meterColor},
                }}
                value={values.value}
              />
              {errors.value ? (
                <FormHelperText>{errors.value}</FormHelperText>
              ) : floor ? (
                <Typography color="text.secondary" sx={{mt: 0.5}} variant="body2">
                  Counter read {formatReadingValue(floor.value, meter.unit)} on{" "}
                  {floor.recordedAt.toLocaleDateString(undefined, {dateStyle: "medium"})}. The value
                  only moves forward.
                </Typography>
              ) : (
                <Typography color="text.secondary" sx={{mt: 0.5}} variant="body2">
                  This is the first reading for this meter.
                </Typography>
              )}
            </FormControl>
            <FormControl error={Boolean(errors.recordedAt)} fullWidth>
              <InputLabel shrink>Reading taken at</InputLabel>
              <OutlinedInput
                label="Reading taken at"
                name="recordedAt"
                onChange={(event) => {
                  setValues((prev) => ({...prev, recordedAt: event.target.value}));
                  setErrors((prev) => ({...prev, recordedAt: undefined}));
                }}
                type="datetime-local"
                value={values.recordedAt}
              />
              {errors.recordedAt ? <FormHelperText>{errors.recordedAt}</FormHelperText> : null}
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button loading={createReadingMutation.isPending} type="submit" variant="contained">
            Record reading
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** Unwraps the latest-reading query response; 404 before the first reading. */
function latestReadingOf(
  response: Awaited<ReturnType<typeof getLatestReading>> | undefined,
): {value: number; recordedAt: string} | null {
  if (!response || isErrorResponse(response)) {
    return null;
  }
  return {value: response.data.value, recordedAt: response.data.recordedAt};
}

/** The hook takes the id separately; keep the call site honest. */
function meterId(meter: Meter): string {
  return meter.id;
}
