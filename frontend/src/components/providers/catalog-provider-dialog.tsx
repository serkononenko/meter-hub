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
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {isErrorResponse} from "@/lib/api/problems";
import {
  getListProvidersQueryKey,
  useCreateProvider,
  useUpdateProvider,
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

export interface CatalogProviderDialogProps {
  /** Provider to edit, or null to create a new catalog provider. */
  provider: Provider | null;
  onClose: () => void;
  open: boolean;
}

/**
 * Create/edit dialog for catalog (GLOBAL) providers. The default window
 * is a template copied into new household accounts — editing it later
 * never changes existing accounts.
 */
export function CatalogProviderDialog({provider, onClose, open}: CatalogProviderDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const createMutation = useCreateProvider();
  const updateMutation = useUpdateProvider();

  const [name, setName] = React.useState(provider?.name ?? "");
  const [notes, setNotes] = React.useState(provider?.notes ?? "");
  const [rule, setRule] = React.useState<RuleFormValue>(
    provider?.defaultRule ? ruleFormFrom(provider.defaultRule) : emptyRuleForm,
  );
  const [ruleEnabled, setRuleEnabled] = React.useState(provider ? Boolean(provider.defaultRule) : true);
  const [error, setError] = React.useState<string | null>(null);

  // The parent mounts this dialog per target (new vs. one provider), so
  // the initial state above is the reset.

  const submit = React.useCallback(
    async (event: React.FormEvent): Promise<void> => {
      event.preventDefault();
      setError(null);

      if (!name.trim()) {
        setError("Name is required");
        return;
      }
      let parsedRule = null;
      if (ruleEnabled) {
        const parsed = parseRuleForm(rule);
        if (parsed.error) {
          setError(parsed.error);
          return;
        }
        parsedRule = parsed.rule ?? null;
      }

      const response = provider
        ? await updateMutation.mutateAsync({
            providerId: provider.id,
            data: {
              name: name.trim(),
              notes: notes.trim() || undefined,
              ...(ruleEnabled ? {defaultRule: parsedRule ?? undefined} : {}),
            },
          })
        : await createMutation.mutateAsync({
            data: {
              scope: "GLOBAL",
              name: name.trim(),
              notes: notes.trim() || undefined,
              ...(ruleEnabled && parsedRule ? {defaultRule: parsedRule} : {}),
            },
          });

      if (isErrorResponse(response)) {
        setError(providerProblemMessage(response.data));
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: getListProvidersQueryKey({includeArchived: true}),
      });
      onClose();
    },
    [provider, name, notes, rule, ruleEnabled, createMutation, updateMutation, queryClient, onClose],
  );

  const archive = React.useCallback(
    async (archived: boolean): Promise<void> => {
      if (!provider) {
        return;
      }
      setError(null);
      const response = await updateMutation.mutateAsync({
        providerId: provider.id,
        data: {archived},
      });
      if (isErrorResponse(response)) {
        setError(providerProblemMessage(response.data));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: getListProvidersQueryKey({includeArchived: true}),
      });
      onClose();
    },
    [provider, updateMutation, queryClient, onClose],
  );

  return (
    <Dialog onClose={onClose} open={open} maxWidth="sm" fullWidth>
      <form onSubmit={submit}>
        <DialogTitle>{provider ? "Edit provider" : "Add catalog provider"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{pt: 1}}>
            <FormControl error={error === "Name is required"} fullWidth>
              <InputLabel>Name</InputLabel>
              <OutlinedInput
                label="Name"
                onChange={(event) => setName(event.target.value)}
                placeholder="City Power"
                value={name}
              />
              {error === "Name is required" ? <FormHelperText>Name is required</FormHelperText> : null}
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Notes (optional)</InputLabel>
              <OutlinedInput
                label="Notes (optional)"
                multiline
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                value={notes}
              />
            </FormControl>
            <Divider />
            {provider?.archived ? (
              <Typography color="text.secondary" variant="body2">
                This provider is archived; restore it to make changes.
              </Typography>
            ) : (
              <>
                <RuleFormControlled
                  onChange={(next) => {
                    setRule(next);
                    setRuleEnabled(true);
                  }}
                  value={rule}
                />
                {error && error !== "Name is required" ? <FormHelperText error>{error}</FormHelperText> : null}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{justifyContent: "space-between"}}>
          {provider ? (
            provider.archived ? (
              <Button color="secondary" onClick={() => void archive(false)}>
                Restore
              </Button>
            ) : (
              <Button color="error" onClick={() => void archive(true)}>
                Archive
              </Button>
            )
          ) : null}
          <Stack direction="row" spacing={1}>
            <Button color="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={createMutation.isPending || updateMutation.isPending} type="submit" variant="contained">
              {provider ? "Save changes" : "Add provider"}
            </Button>
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/**
 * The rule form with the ability to say a provider suggests no window at
 * all (defaultRule is optional in the contract).
 */
function RuleFormControlled({onChange, value}: {onChange: (next: RuleFormValue) => void; value: RuleFormValue}): React.JSX.Element {
  return <RuleForm onChange={onChange} value={value} />;
}
