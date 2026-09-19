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
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";

import {fieldErrorsOf, isErrorResponse, problemMessage} from "@/lib/api/problems";
import {getGetMeterQueryKey, getListMetersQueryKey, useUpdateMeter} from "@/lib/api/generated/meter-service";
import type {Meter} from "@/lib/api/generated/meter-service/model";
import {MeterUnit} from "@/lib/api/generated/meter-service/model";
import {meterStatusLabels, meterUnitLabels, meterUnitsByType} from "@/lib/meters/labels";

export interface MeterEditDialogProps {
  meter: Meter;
  onClose: () => void;
  open: boolean;
}

interface Values {
  name: string;
  serialNumber: string;
  unit: MeterUnit;
  status: Meter["status"];
}

/**
 * Modal form for editing an existing meter's mutable fields and for
 * archiving/restoring it. Archived meters keep their historical readings.
 */
export function MeterEditDialog({meter, onClose, open}: MeterEditDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const updateMeterMutation = useUpdateMeter();

  const [values, setValues] = React.useState<Values>({
    name: meter.name,
    serialNumber: meter.serialNumber,
    unit: meter.unit,
    status: meter.status,
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof Values, string>>>({});
  const [lastMeter, setLastMeter] = React.useState<Meter>(meter);

  // Re-sync the fields whenever a different meter is opened (reset state
  // during render when the edited meter changed — the React-recommended
  // pattern instead of a setState-in-effect).
  if (meter !== lastMeter) {
    setLastMeter(meter);
    setValues({
      name: meter.name,
      serialNumber: meter.serialNumber,
      unit: meter.unit,
      status: meter.status,
    });
    setErrors({});
  }

  const handleClose = React.useCallback((): void => {
    onClose();
  }, [onClose]);

  const submit = React.useCallback(
    async (event: React.FormEvent): Promise<void> => {
      event.preventDefault();

      const nextErrors: typeof errors = {};
      if (!values.name.trim()) {
        nextErrors.name = "Name is required";
      }
      if (!values.serialNumber.trim()) {
        nextErrors.serialNumber = "Serial number is required";
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      const response = await updateMeterMutation.mutateAsync({
        meterId: meter.id,
        data: {
          name: values.name.trim(),
          serialNumber: values.serialNumber.trim(),
          unit: values.unit,
          status: values.status,
        },
      });

      if (isErrorResponse(response)) {
        const fieldErrors = fieldErrorsOf(response.data);
        setErrors({
          name: fieldErrors.name,
          serialNumber: fieldErrors.serialNumber,
          ...(!fieldErrors.name && !fieldErrors.serialNumber
            ? {name: problemMessage(response.data)}
            : {}),
        });
        return;
      }

      await queryClient.invalidateQueries({queryKey: getListMetersQueryKey()});
      await queryClient.invalidateQueries({queryKey: getGetMeterQueryKey(meter.id)});
      onClose();
    },
    [meter, values, updateMeterMutation, queryClient, onClose],
  );

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="xs" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>Edit meter</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{mb: 2}}>
            Changes apply immediately. Archiving keeps the meter&apos;s
            historical readings addressable.
          </DialogContentText>
          <Stack spacing={2}>
            <FormControl error={Boolean(errors.name)} fullWidth>
              <InputLabel>Name</InputLabel>
              <OutlinedInput
                label="Name"
                name="name"
                onChange={(event) => {
                  setValues((prev) => ({...prev, name: event.target.value}));
                  setErrors((prev) => ({...prev, name: undefined}));
                }}
                value={values.name}
              />
              {errors.name ? <FormHelperText>{errors.name}</FormHelperText> : null}
            </FormControl>
            <FormControl error={Boolean(errors.serialNumber)} fullWidth>
              <InputLabel>Serial number</InputLabel>
              <OutlinedInput
                label="Serial number"
                name="serialNumber"
                onChange={(event) => {
                  setValues((prev) => ({...prev, serialNumber: event.target.value}));
                  setErrors((prev) => ({...prev, serialNumber: undefined}));
                }}
                value={values.serialNumber}
              />
              {errors.serialNumber ? <FormHelperText>{errors.serialNumber}</FormHelperText> : null}
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Unit</InputLabel>
              <Select
                label="Unit"
                onChange={(event) => {
                  setValues((prev) => ({...prev, unit: event.target.value as MeterUnit}));
                }}
                value={values.unit}
              >
                {meterUnitsByType[meter.type].map((unit) => (
                  <MenuItem key={unit} value={unit}>
                    {meterUnitLabels[unit]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                onChange={(event) => {
                  setValues((prev) => ({...prev, status: event.target.value as Meter["status"]}));
                }}
                value={values.status}
              >
                {(Object.keys(meterStatusLabels) as Meter["status"][]).map((status) => (
                  <MenuItem key={status} value={status}>
                    {meterStatusLabels[status]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={updateMeterMutation.isPending} type="submit" variant="contained">
            Save changes
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
