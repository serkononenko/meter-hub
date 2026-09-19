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
import {
  getListMetersQueryKey,
  useCreateMeter,
} from "@/lib/api/generated/meter-service";
import {MeterType, MeterUnit} from "@/lib/api/generated/meter-service/model";
import {
  meterTypeLabels,
  meterUnitsByType,
  meterUnitLabels,
} from "@/lib/meters/labels";

export interface MeterCreateDialogProps {
  householdId: string;
  onClose: () => void;
  open: boolean;
}

interface Values {
  type: MeterType;
  name: string;
  serialNumber: string;
  unit: MeterUnit;
}

/**
 * Modal form for registering a meter in a household. The unit options
 * follow the selected type (electricity is always kWh, gas m³, water m³
 * or litres).
 */
export function MeterCreateDialog({householdId, onClose, open}: MeterCreateDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const createMeterMutation = useCreateMeter();

  const [values, setValues] = React.useState<Values>({
    type: "ELECTRICITY",
    name: "",
    serialNumber: "",
    unit: "KWH",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof Values, string>>>({});

  const reset = React.useCallback((): void => {
    setValues({type: "ELECTRICITY", name: "", serialNumber: "", unit: "KWH"});
    setErrors({});
  }, []);

  const handleClose = React.useCallback((): void => {
    reset();
    onClose();
  }, [onClose, reset]);

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

      const response = await createMeterMutation.mutateAsync({
        data: {
          householdId,
          type: values.type,
          name: values.name.trim(),
          serialNumber: values.serialNumber.trim(),
          unit: values.unit,
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

      await queryClient.invalidateQueries({
        queryKey: getListMetersQueryKey({householdId}),
      });
      handleClose();
    },
    [householdId, values, createMeterMutation, queryClient, handleClose],
  );

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="xs" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>Add meter</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{mb: 2}}>
            Register a physical meter. The serial number is the one printed by
            the manufacturer.
          </DialogContentText>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                onChange={(event) => {
                  const type = event.target.value as MeterType;
                  setValues((prev) => ({
                    ...prev,
                    type,
                    // Keep the unit consistent with the chosen type.
                    unit: meterUnitsByType[type][0],
                  }));
                  setErrors((prev) => ({...prev, type: undefined}));
                }}
                value={values.type}
              >
                {(Object.keys(meterTypeLabels) as MeterType[]).map((type) => (
                  <MenuItem key={type} value={type}>
                    {meterTypeLabels[type]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl error={Boolean(errors.name)} fullWidth>
              <InputLabel>Name</InputLabel>
              <OutlinedInput
                label="Name"
                name="name"
                onChange={(event) => {
                  setValues((prev) => ({...prev, name: event.target.value}));
                  setErrors((prev) => ({...prev, name: undefined}));
                }}
                placeholder="Kitchen electricity"
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
                {meterUnitsByType[values.type].map((unit) => (
                  <MenuItem key={unit} value={unit}>
                    {meterUnitLabels[unit]}
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
          <Button disabled={createMeterMutation.isPending} type="submit" variant="contained">
            Add meter
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
