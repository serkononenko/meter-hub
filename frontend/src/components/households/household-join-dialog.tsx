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
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {isErrorResponse} from "@/lib/api/problems";
import {
  getListHouseholdsQueryKey,
  useRedeemHouseholdInvite,
} from "@/lib/api/generated/household-service";
import {householdRoleLabels} from "@/lib/households/labels";

export interface HouseholdJoinDialogProps {
  onClose: () => void;
  open: boolean;
}

/**
 * Inline "Join household" dialog on the households list: paste an invite
 * code, land in the household. Success adds the household to the list.
 */
export function HouseholdJoinDialog({onClose, open}: HouseholdJoinDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const redeemMutation = useRedeemHouseholdInvite();

  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [joined, setJoined] = React.useState<{householdName: string; role: string} | null>(null);

  const reset = React.useCallback((): void => {
    setCode("");
    setError(null);
    setJoined(null);
  }, []);

  const handleClose = React.useCallback((): void => {
    reset();
    onClose();
  }, [onClose, reset]);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Paste the invitation code you received.");
      return;
    }

    const response = await redeemMutation.mutateAsync({data: {code: code.trim()}});

    if (isErrorResponse(response)) {
      setError(problemText(response.status, response.data.detail ?? response.data.title));
      return;
    }

    setJoined({householdName: response.data.householdName, role: response.data.role});
    await queryClient.invalidateQueries({queryKey: getListHouseholdsQueryKey()});
  };

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="xs" fullWidth>
      {joined ? (
        <React.Fragment>
          <DialogTitle>You’re in</DialogTitle>
          <DialogContent>
            <Stack spacing={1}>
              <Typography variant="h6" component="p">
                {joined.householdName}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                You joined as {householdRoleLabels[joined.role as keyof typeof householdRoleLabels] ?? joined.role}.
                The household now appears in your list.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} variant="contained">
              Done
            </Button>
          </DialogActions>
        </React.Fragment>
      ) : (
        <form onSubmit={submit}>
          <DialogTitle>Join a household</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{mb: 2}}>
              Paste the invitation code someone shared with you.
            </DialogContentText>
            <FormControl error={Boolean(error)} fullWidth>
              <InputLabel>Invitation code</InputLabel>
              <OutlinedInput
                inputProps={{autoCapitalize: "off", autoCorrect: "off", spellCheck: false}}
                label="Invitation code"
                name="code"
                onChange={(event) => {
                  setCode(event.target.value);
                  setError(null);
                }}
                sx={{"& .MuiOutlinedInput-input": {fontFamily: "var(--font-spline-mono), monospace", letterSpacing: "0.08em"}}}
                value={code}
              />
              {error ? <FormHelperText>{error}</FormHelperText> : null}
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button color="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button loading={redeemMutation.isPending} type="submit" variant="contained">
              Join household
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}

/** Problem code → a sentence that says what to do about it. */
function problemText(status: number, detail: string | undefined): string {
  switch (status) {
    case 404:
      return "That code doesn’t match any invitation. Check it for typos.";
    case 409:
      return "That code was already used by someone else.";
    case 410:
      return "That invitation has expired. Ask for a new one.";
    default:
      return detail ?? "The code could not be redeemed.";
  }
}
