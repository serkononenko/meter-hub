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
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import {isErrorResponse} from "@/lib/api/problems";
import {
  createMeterBinding,
  endMeterBinding,
  getListMeterBindingsQueryKey,
  getGetSubmissionWindowsQueryKey,
  useListProviderAccounts,
} from "@/lib/api/generated/provider-service";
import type {Meter} from "@/lib/api/generated/meter-service/model";
import {providerProblemMessage} from "@/lib/providers/problems";

export interface MeterBindingDialogProps {
  /** The meter's current open binding; null when unbound. */
  currentBindingId?: string | null;
  meter: Meter;
  onClose: () => void;
  open: boolean;
}

/**
 * Bind/unbind dialog for one meter. Binding picks an account (the account
 * list is already scoped to the meter's household); unbinding takes the
 * end date and keeps the binding as history.
 */
export function MeterBindingDialog({currentBindingId, meter, onClose, open}: MeterBindingDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const accountsQuery = useListProviderAccounts({householdId: meter.householdId});

  const [accountId, setAccountId] = React.useState("");
  const [validFrom, setValidFrom] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const accounts =
    accountsQuery.data && !isErrorResponse(accountsQuery.data)
      ? accountsQuery.data.data.filter((account) => !account.archived)
      : [];

  // Default the account pick to the first one when the selection is empty;
  // derives during render instead of an effect calling setState.
  const effectiveAccountId = accountId || accounts[0]?.id || "";

  const invalidate = React.useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: getListMeterBindingsQueryKey({meterId: meter.id}),
    });
    await queryClient.invalidateQueries({
      queryKey: getGetSubmissionWindowsQueryKey({meterId: meter.id}),
    });
  }, [queryClient, meter.id]);

  const submit = React.useCallback(
    async (event: React.FormEvent): Promise<void> => {
      event.preventDefault();
      setError(null);
      setPending(true);
      try {
        if (currentBindingId) {
          const response = await endMeterBinding(currentBindingId, {validTo});
          if (isErrorResponse(response)) {
            setError(providerProblemMessage(response.data));
            return;
          }
        } else {
          if (!effectiveAccountId) {
            setError("Pick an account");
            return;
          }
          const response = await createMeterBinding({accountId: effectiveAccountId, meterId: meter.id, validFrom});
          if (isErrorResponse(response)) {
            setError(providerProblemMessage(response.data));
            return;
          }
        }
        await invalidate();
        onClose();
      } finally {
        setPending(false);
      }
    },
    [currentBindingId, effectiveAccountId, validFrom, validTo, meter.id, invalidate, onClose],
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog onClose={onClose} open={open} maxWidth="xs" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>{currentBindingId ? "End provider link" : "Link provider"}</DialogTitle>
        <DialogContent>
          {currentBindingId ? (
            <Stack spacing={2} sx={{pt: 1}}>
              <DialogContentText>
                Set the last day this meter reports to the linked account. The
                link stays in history, and a new one can start the next day.
              </DialogContentText>
              <TextField
                error={Boolean(error)}
                fullWidth
                helperText={error ?? undefined}
                label="Last day"
                onChange={(event) => setValidTo(event.target.value)}
                slotProps={{htmlInput: {min: today}}}
                type="date"
                value={validTo}
              />
            </Stack>
          ) : (
            <Stack spacing={2} sx={{pt: 1}}>
              <DialogContentText>
                Choose the provider account this meter reports to. The account
                decides when readings are due.
              </DialogContentText>
              <FormControl error={Boolean(error && !effectiveAccountId)} fullWidth>
                <InputLabel>Account</InputLabel>
                <Select
                  label="Account"
                  onChange={(event) => setAccountId(event.target.value)}
                  value={effectiveAccountId}
                >
                  {accounts.length > 0 ? (
                    accounts.map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.label}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled value="">
                      No provider accounts yet — add one first
                    </MenuItem>
                  )}
                </Select>
                {error && !effectiveAccountId ? <FormHelperText>{error}</FormHelperText> : null}
              </FormControl>
              <TextField
                fullWidth
                label="Valid from"
                onChange={(event) => setValidFrom(event.target.value)}
                type="date"
                value={validFrom}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!currentBindingId && accounts.length === 0}
            loading={pending}
            type="submit"
            variant="contained"
          >
            {currentBindingId ? "End link" : "Link account"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
