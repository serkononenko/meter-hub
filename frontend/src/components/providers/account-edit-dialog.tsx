"use client";

import * as React from "react";
import {useQueryClient} from "@tanstack/react-query";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {isErrorResponse} from "@/lib/api/problems";
import {
  getListProviderAccountsQueryKey,
  useListProviders,
  useUpdateProviderAccount,
} from "@/lib/api/generated/provider-service";
import type {ProviderAccount} from "@/lib/api/generated/provider-service/model";
import {providerProblemMessage} from "@/lib/providers/problems";

import {
  parseRuleForm,
  RuleForm,
  ruleFormFrom,
  type RuleFormValue,
} from "./rule-form";

export interface AccountEditDialogProps {
  account: ProviderAccount;
  householdId: string;
  onClose: () => void;
  open: boolean;
}

/**
 * Editor for an existing provider account: label, account number, rule,
 * provider re-pointing, and archiving. Archived accounts are read-only —
 * the API rejects changes, so the form fields disable.
 */
export function AccountEditDialog({account, householdId, onClose, open}: AccountEditDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const updateMutation = useUpdateProviderAccount();
  const providersQuery = useListProviders({householdId});

  const [values, setValues] = React.useState({
    label: account.label,
    accountNumber: account.accountNumber ?? "",
    providerId: account.providerId,
  });
  const [rule, setRule] = React.useState<RuleFormValue>(ruleFormFrom(account.rule));
  const [error, setError] = React.useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = React.useState(false);

  const providers =
    providersQuery.data && !isErrorResponse(providersQuery.data)
      ? providersQuery.data.data.filter((provider) => !provider.archived || provider.id === account.providerId)
      : [];

  // The parent mounts this dialog per account (keyed by id), so the
  // initial state above is the reset.

  const handleClose = React.useCallback((): void => {
    onClose();
  }, [onClose]);

  const submit = React.useCallback(
    async (event: React.FormEvent): Promise<void> => {
      event.preventDefault();
      setError(null);

      const parsed = parseRuleForm(rule);
      if (parsed.error) {
        setError(parsed.error);
        return;
      }

      const response = await updateMutation.mutateAsync({
        accountId: account.id,
        data: {
          label: values.label.trim(),
          accountNumber: values.accountNumber.trim() || undefined,
          providerId: values.providerId,
          rule: parsed.rule,
        },
      });

      if (isErrorResponse(response)) {
        setError(providerProblemMessage(response.data));
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: getListProviderAccountsQueryKey({householdId}),
      });
      handleClose();
    },
    [account.id, values, rule, updateMutation, queryClient, householdId, handleClose],
  );

  const archive = React.useCallback(async (): Promise<void> => {
    setError(null);
    const response = await updateMutation.mutateAsync({
      accountId: account.id,
      data: {archived: true},
    });
    if (isErrorResponse(response)) {
      setError(providerProblemMessage(response.data));
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: getListProviderAccountsQueryKey({householdId}),
    });
    handleClose();
  }, [account.id, updateMutation, queryClient, householdId, handleClose]);

  const disabled = account.archived;

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="sm" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>Edit account</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{pt: 1}}>
            <FormControl disabled={disabled} error={Boolean(error)} fullWidth>
              <InputLabel>Label</InputLabel>
              <OutlinedInput
                label="Label"
                onChange={(event) => setValues((prev) => ({...prev, label: event.target.value}))}
                value={values.label}
              />
            </FormControl>
            <FormControl disabled={disabled} fullWidth>
              <InputLabel>Account number</InputLabel>
              <OutlinedInput
                label="Account number"
                onChange={(event) => setValues((prev) => ({...prev, accountNumber: event.target.value}))}
                value={values.accountNumber}
              />
            </FormControl>
            <FormControl disabled={disabled} fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select
                label="Provider"
                onChange={(event) => setValues((prev) => ({...prev, providerId: event.target.value}))}
                value={values.providerId}
              >
                {providers.map((provider) => (
                  <MenuItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Switching keeps the account number and history; only the provider changes.</FormHelperText>
            </FormControl>
            <Divider />
            {disabled ? (
              <Typography color="text.secondary" variant="body2">
                This account is archived; restore it to make changes.
              </Typography>
            ) : (
              <RuleForm onChange={setRule} value={rule} />
            )}
            {error ? <FormHelperText error>{error}</FormHelperText> : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{justifyContent: "space-between"}}>
          {account.archived ? (
            <Button
              color="secondary"
              disabled={updateMutation.isPending}
              onClick={() =>
                void (async () => {
                  setError(null);
                  const response = await updateMutation.mutateAsync({
                    accountId: account.id,
                    data: {archived: false},
                  });
                  if (isErrorResponse(response)) {
                    setError(providerProblemMessage(response.data));
                    return;
                  }
                  await queryClient.invalidateQueries({
                    queryKey: getListProviderAccountsQueryKey({householdId}),
                  });
                  handleClose();
                })()
              }
            >
              Restore
            </Button>
          ) : confirmArchive ? (
            <>
              <Button color="error" loading={updateMutation.isPending} onClick={() => void archive()}>
                Confirm archive
              </Button>
              <Button color="secondary" onClick={() => setConfirmArchive(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button color="error" onClick={() => setConfirmArchive(true)}>
              Archive account
            </Button>
          )}
          <Stack direction="row" spacing={1}>
            <Button color="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button disabled={disabled} loading={updateMutation.isPending} type="submit" variant="contained">
              Save changes
            </Button>
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
}
