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
import OutlinedInput from "@mui/material/OutlinedInput";

import {isErrorResponse, problemMessage} from "@/lib/api/problems";
import {
  getGetHouseholdQueryKey,
  getListHouseholdsQueryKey,
  useCreateHousehold,
} from "@/lib/api/generated/household-service";

export interface HouseholdCreateDialogProps {
  onClose: () => void;
  open: boolean;
}

/**
 * Modal form for creating a household owned by the signed-in user. On
 * success the household list is refreshed and the dialog closes.
 */
export function HouseholdCreateDialog({onClose, open}: HouseholdCreateDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const createHouseholdMutation = useCreateHousehold();

  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const reset = React.useCallback((): void => {
    setName("");
    setError(null);
  }, []);

  const handleClose = React.useCallback((): void => {
    reset();
    onClose();
  }, [onClose, reset]);

  const submit = React.useCallback(
    async (event: React.FormEvent): Promise<void> => {
      event.preventDefault();

      if (!name.trim()) {
        setError("Name is required");
        return;
      }

      const response = await createHouseholdMutation.mutateAsync({data: {name: name.trim()}});

      if (isErrorResponse(response)) {
        setError(problemMessage(response.data));
        return;
      }

      await queryClient.invalidateQueries({queryKey: getListHouseholdsQueryKey()});
      await queryClient.invalidateQueries({queryKey: getGetHouseholdQueryKey(response.data.id)});
      handleClose();
    },
    [name, createHouseholdMutation, queryClient, handleClose],
  );

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="xs" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>Create household</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{mb: 2}}>
            Name your household, for example “Home” or “Summer cottage”.
          </DialogContentText>
          <FormControl error={Boolean(error)} fullWidth>
            <InputLabel>Name</InputLabel>
            <OutlinedInput
              label="Name"
              name="name"
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              value={name}
            />
            {error ? <FormHelperText>{error}</FormHelperText> : null}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button loading={createHouseholdMutation.isPending} type="submit" variant="contained">
            Create household
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
