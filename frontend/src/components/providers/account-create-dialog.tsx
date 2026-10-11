"use client";

import * as React from "react";
import {useQueryClient} from "@tanstack/react-query";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
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
  useCreateProvider,
  useCreateProviderAccount,
  useListProviders,
} from "@/lib/api/generated/provider-service";
import type {Provider} from "@/lib/api/generated/provider-service/model";
import {providerProblemMessage} from "@/lib/providers/problems";

import {
  emptyRuleForm,
  parseRuleForm,
  RuleForm,
  ruleFormFrom,
  type RuleFormValue,
} from "./rule-form";

export interface AccountCreateDialogProps {
  householdId: string;
  onClose: () => void;
  open: boolean;
}

interface Values {
  providerId: string;
  label: string;
  accountNumber: string;
}

/** Picker value for defining a new private provider inline. */
const NEW_PROVIDER = "__new__";

/**
 * Modal form for linking a provider account. The provider picker lists the
 * shared catalog first, then the household's private providers; "Add my
 * own" creates a private provider inline. Picking a provider with a
 * default window prefills the rule form.
 */
export function AccountCreateDialog({householdId, onClose, open}: AccountCreateDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const createAccountMutation = useCreateProviderAccount();
  const createProviderMutation = useCreateProvider();
  const providersQuery = useListProviders({householdId});

  const [values, setValues] = React.useState<Values>({providerId: "", label: "", accountNumber: ""});
  const [newProviderName, setNewProviderName] = React.useState("");
  const [rule, setRule] = React.useState<RuleFormValue>(emptyRuleForm);
  const [ruleTouched, setRuleTouched] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Values | "rule", string>>>({});

  const providers =
    providersQuery.data && !isErrorResponse(providersQuery.data)
      ? providersQuery.data.data.filter((provider) => !provider.archived)
      : [];
  const selectedProvider = providers.find((provider) => provider.id === values.providerId);

  const reset = React.useCallback((): void => {
    setValues({providerId: "", label: "", accountNumber: ""});
    setNewProviderName("");
    setRule(emptyRuleForm);
    setRuleTouched(false);
    setErrors({});
  }, []);

  const handleClose = React.useCallback((): void => {
    reset();
    onClose();
  }, [onClose, reset]);

  const pickProvider = React.useCallback((provider: Provider): void => {
    setValues((prev) => ({...prev, providerId: provider.id}));
    setErrors((prev) => ({...prev, providerId: undefined}));
    if (provider.defaultRule && !ruleTouched) {
      setRule(ruleFormFrom(provider.defaultRule));
    }
  }, [ruleTouched]);

  const submit = React.useCallback(
    async (event: React.FormEvent): Promise<void> => {
      event.preventDefault();

      const nextErrors: typeof errors = {};
      if (!values.providerId) {
        nextErrors.providerId = "Pick a provider";
      }
      if (values.providerId === NEW_PROVIDER && !newProviderName.trim()) {
        nextErrors.providerId = "Name your provider";
      }
      if (!values.label.trim()) {
        nextErrors.label = "Label is required";
      }
      const parsed = parseRuleForm(rule);
      if (parsed.error) {
        nextErrors.rule = parsed.error;
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      let providerId = values.providerId;
      if (providerId === NEW_PROVIDER) {
        const providerResponse = await createProviderMutation.mutateAsync({
          data: {
            scope: "HOUSEHOLD",
            householdId,
            name: newProviderName.trim(),
          },
        });
        if (isErrorResponse(providerResponse)) {
          setErrors({providerId: providerProblemMessage(providerResponse.data)});
          return;
        }
        providerId = providerResponse.data.id;
      }

      const response = await createAccountMutation.mutateAsync({
        data: {
          providerId,
          householdId,
          label: values.label.trim(),
          accountNumber: values.accountNumber.trim() || undefined,
          rule: parsed.rule,
        },
      });

      if (isErrorResponse(response)) {
        setErrors({
          label: providerProblemMessage(response.data),
        });
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: getListProviderAccountsQueryKey({householdId}),
      });
      handleClose();
    },
    [householdId, values, newProviderName, rule, createAccountMutation, createProviderMutation, queryClient, handleClose],
  );

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="sm" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>Add provider account</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{mb: 2}}>
            Link your account with a service provider to track when readings
            are due.
          </DialogContentText>
          <Stack spacing={2}>
            <FormControl error={Boolean(errors.providerId)} fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select
                label="Provider"
                onChange={(event) => {
                  const picked = event.target.value;
                  setValues((prev) => ({...prev, providerId: picked}));
                  setErrors((prev) => ({...prev, providerId: undefined}));
                  if (picked === NEW_PROVIDER) {
                    return;
                  }
                  const provider = providers.find((p) => p.id === picked);
                  if (provider) {
                    pickProvider(provider);
                  }
                }}
                value={values.providerId}
              >
                {providers.map((provider) => (
                  <MenuItem key={provider.id} value={provider.id}>
                    {provider.name}
                    {provider.scope === "HOUSEHOLD" ? " (private)" : ""}
                  </MenuItem>
                ))}
                <Divider />
                <MenuItem value={NEW_PROVIDER}>Add my own provider…</MenuItem>
              </Select>
              {errors.providerId ? <FormHelperText>{errors.providerId}</FormHelperText> : null}
            </FormControl>
            {values.providerId === NEW_PROVIDER ? (
              <FormControl error={errors.providerId === "Name your provider"} fullWidth>
                <InputLabel>Provider name</InputLabel>
                <OutlinedInput
                  label="Provider name"
                  onChange={(event) => {
                    setNewProviderName(event.target.value);
                    setErrors((prev) => ({...prev, providerId: undefined}));
                  }}
                  placeholder="Dnipro Water Services"
                  value={newProviderName}
                />
                <FormHelperText>Created privately for this household; an administrator can promote it to the catalog later.</FormHelperText>
              </FormControl>
            ) : null}
            {selectedProvider?.notes ? (
              <Typography color="text.secondary" variant="body2">
                {selectedProvider.notes}
              </Typography>
            ) : null}
            <FormControl error={Boolean(errors.label)} fullWidth>
              <InputLabel>Label</InputLabel>
              <OutlinedInput
                label="Label"
                name="label"
                onChange={(event) => {
                  setValues((prev) => ({...prev, label: event.target.value}));
                  setErrors((prev) => ({...prev, label: undefined}));
                }}
                placeholder="City Power, flat"
                value={values.label}
              />
              {errors.label ? <FormHelperText>{errors.label}</FormHelperText> : null}
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Account number (optional)</InputLabel>
              <OutlinedInput
                label="Account number (optional)"
                name="accountNumber"
                onChange={(event) => setValues((prev) => ({...prev, accountNumber: event.target.value}))}
                value={values.accountNumber}
              />
            </FormControl>
            <Divider />
            <RuleForm
              onChange={(next) => {
                setRule(next);
                setRuleTouched(true);
              }}
              value={rule}
            />
            {errors.rule ? <FormHelperText error>{errors.rule}</FormHelperText> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button loading={createAccountMutation.isPending} type="submit" variant="contained">
            Add account
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
