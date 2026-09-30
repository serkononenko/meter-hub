"use client";

import * as React from "react";
import {useQueryClient} from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {isErrorResponse, problemMessage} from "@/lib/api/problems";
import {
  getGetHouseholdQueryKey,
  getListHouseholdInvitesQueryKey,
  getListHouseholdMembersQueryKey,
  useListHouseholdInvites,
  useListHouseholdMembers,
  useCreateHouseholdInvite,
  useRemoveHouseholdMember,
  useRevokeHouseholdInvite,
} from "@/lib/api/generated/household-service";
import type {HouseholdRole, Invite, Member} from "@/lib/api/generated/household-service/model";
import {householdRoleLabels} from "@/lib/households/labels";

export interface MembersPanelProps {
  householdId: string;
}

/**
 * Owner-only roster of a household: members with role chips and removal,
 * invite creation with the one-time code shown exactly once, and the list
 * of live invites with revoke. Hidden from non-owners by the details page.
 */
export function MembersPanel({householdId}: MembersPanelProps): React.JSX.Element {
  const membersQuery = useListHouseholdMembers(householdId);
  const invitesQuery = useListHouseholdInvites(householdId);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{alignItems: "center", justifyContent: "space-between", mb: 2}}>
          <Typography variant="h6">Members and invites</Typography>
          <Button onClick={() => setInviteOpen(true)} size="small" variant="outlined">
            Invite someone
          </Button>
        </Stack>
        {renderMembers()}
        <Divider sx={{my: 3}} />
        <Typography color="text.secondary" variant="body2" sx={{mb: 1}}>
          Live invitations — unredeemed codes you can still revoke.
        </Typography>
        {renderInvites()}
      </CardContent>
      <InviteDialog householdId={householdId} onClose={() => setInviteOpen(false)} open={inviteOpen} />
    </Card>
  );

  function renderMembers(): React.JSX.Element {
    const response = membersQuery.data;

    if (membersQuery.isPending) {
      return <Skeleton height={56} variant="rounded" />;
    }
    if (membersQuery.isError || !response || isErrorResponse(response)) {
      return (
        <Typography color="error" variant="body2">
          {response && isErrorResponse(response) ? problemMessage(response.data) : "Could not load members."}
        </Typography>
      );
    }

    return (
      <Stack spacing={1.5}>
        {response.data.map((member) => (
          <MemberRow householdId={householdId} key={member.id} member={member} />
        ))}
      </Stack>
    );
  }

  function renderInvites(): React.JSX.Element {
    const response = invitesQuery.data;

    if (invitesQuery.isPending) {
      return <Skeleton height={56} variant="rounded" />;
    }
    if (invitesQuery.isError || !response || isErrorResponse(response)) {
      return (
        <Typography color="error" variant="body2">
          {response && isErrorResponse(response) ? problemMessage(response.data) : "Could not load invites."}
        </Typography>
      );
    }
    if (response.data.length === 0) {
      return (
        <Typography color="text.secondary" variant="body2">
          No live invitations. Create one to share a code.
        </Typography>
      );
    }

    return (
      <Stack spacing={1.5}>
        {response.data.map((invite) => (
          <InviteRow householdId={householdId} invite={invite} key={invite.id} />
        ))}
      </Stack>
    );
  }
}

function MemberRow({householdId, member}: {householdId: string; member: Member}): React.JSX.Element {
  const queryClient = useQueryClient();
  const removeMutation = useRemoveHouseholdMember();
  const [error, setError] = React.useState<string | null>(null);

  const remove = async (): Promise<void> => {
    setError(null);
    const response = await removeMutation.mutateAsync({householdId, userId: member.userId});
    if (isErrorResponse(response)) {
      setError(problemMessage(response.data));
      return;
    }
    await queryClient.invalidateQueries({queryKey: getListHouseholdMembersQueryKey(householdId)});
  };

  return (
    <Stack direction="row" spacing={2} sx={{alignItems: "center", justifyContent: "space-between"}}>
      <Stack spacing={0.5} sx={{minWidth: 0}}>
        <Stack direction="row" spacing={1.5} sx={{alignItems: "center"}}>
          {/* Member users are identified by id in the MVP roster. */}
          <Typography sx={{fontFamily: "var(--font-spline-mono), monospace", fontSize: "0.875rem"}} variant="body2">
            {member.userId}
          </Typography>
          <RoleChip role={member.role} />
        </Stack>
        {error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : null}
      </Stack>
      {member.role === "OWNER" ? null : (
        <Button
          color="error"
          disabled={removeMutation.isPending}
          onClick={() => void remove()}
          size="small"
          startIcon={<PersonRemoveIcon />}
        >
          Remove
        </Button>
      )}
    </Stack>
  );
}

function InviteRow({householdId, invite}: {householdId: string; invite: Invite}): React.JSX.Element {
  const queryClient = useQueryClient();
  const revokeMutation = useRevokeHouseholdInvite();
  const [error, setError] = React.useState<string | null>(null);

  const revoke = async (): Promise<void> => {
    setError(null);
    const response = await revokeMutation.mutateAsync({householdId, inviteId: invite.id});
    if (isErrorResponse(response)) {
      setError(problemMessage(response.data));
      return;
    }
    await queryClient.invalidateQueries({queryKey: getListHouseholdInvitesQueryKey(householdId)});
  };

  return (
    <Stack direction="row" spacing={2} sx={{alignItems: "center", justifyContent: "space-between"}}>
      <Stack spacing={0.5} sx={{minWidth: 0}}>
        <Stack direction="row" spacing={1.5} sx={{alignItems: "center"}}>
          <RoleChip role={invite.role} />
          <Typography color="text.secondary" variant="body2">
            Expires {new Date(invite.expiresAt).toLocaleDateString(undefined, {day: "numeric", month: "short"})}
          </Typography>
        </Stack>
        {error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : null}
      </Stack>
      <Button color="error" disabled={revokeMutation.isPending} onClick={() => void revoke()} size="small">
        Revoke
      </Button>
    </Stack>
  );
}

export function RoleChip({role}: {role: HouseholdRole}): React.JSX.Element {
  return (
    <Chip
      color={role === "OWNER" ? "primary" : role === "MEMBER" ? "secondary" : "default"}
      label={householdRoleLabels[role]}
      size="small"
      variant={role === "VIEWER" ? "outlined" : "filled"}
    />
  );
}

const ROLE_OPTIONS = [
  {value: "MEMBER", label: "Member — can add meters and record readings"},
  {value: "VIEWER", label: "Viewer — can view everything, change nothing"},
] as const;

function InviteDialog({householdId, onClose, open}: {householdId: string; onClose: () => void; open: boolean}): React.JSX.Element {
  const queryClient = useQueryClient();
  const createMutation = useCreateHouseholdInvite();

  const [role, setRole] = React.useState<"MEMBER" | "VIEWER">("MEMBER");
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{code: string; expiresAt: string} | null>(null);

  const reset = React.useCallback((): void => {
    setRole("MEMBER");
    setError(null);
    setCreated(null);
  }, []);

  const handleClose = React.useCallback((): void => {
    reset();
    onClose();
  }, [onClose, reset]);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);

    const response = await createMutation.mutateAsync({householdId, data: {role}});

    if (isErrorResponse(response)) {
      setError(problemMessage(response.data));
      return;
    }

    setCreated({code: response.data.code, expiresAt: response.data.expiresAt});
    await queryClient.invalidateQueries({queryKey: getListHouseholdInvitesQueryKey(householdId)});
    await queryClient.invalidateQueries({queryKey: getGetHouseholdQueryKey(householdId)});
  };

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="xs" fullWidth>
      {created ? (
        <React.Fragment>
          <DialogTitle>Invitation created</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <DialogContentText>
                Share this code with the person you’re inviting. It works once, for the
                first person who redeems it, and expires{" "}
                {new Date(created.expiresAt).toLocaleDateString(undefined, {day: "numeric", month: "long"})}.
              </DialogContentText>
              <InviteCodeField code={created.code} />
              <Alert severity="warning" variant="outlined">
                You won’t see this code again. Copy it now.
              </Alert>
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
          <DialogTitle>Invite someone</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{mb: 2}}>
              They’ll join this household with the role you pick.
            </DialogContentText>
            <FormControl fullWidth sx={{mb: 2}}>
              <InputLabel>Role</InputLabel>
              <Select
                label="Role"
                onChange={(event) => setRole(event.target.value as "MEMBER" | "VIEWER")}
                value={role}
              >
                {ROLE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {error ? (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button color="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button loading={createMutation.isPending} type="submit" variant="contained">
              Create invite
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}

/** The one-time code, styled as the register digits it is. */
function InviteCodeField({code}: {code: string}): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions/insecure context); the code stays
      // selectable so the user can copy it manually.
    }
  };

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px dashed var(--mui-palette-divider)",
        borderRadius: "8px",
        px: 2,
        py: 1.5,
      }}
    >
      <Typography
        component="code"
        sx={{
          fontFamily: "var(--font-spline-mono), monospace",
          fontSize: "1.125rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          userSelect: "all",
        }}
      >
        {code}
      </Typography>
      {copied ? (
        <Typography color="success.main" variant="body2">
          Copied
        </Typography>
      ) : (
        <Link component="button" onClick={() => void copy()} type="button" variant="body2">
          <Stack direction="row" spacing={0.5} sx={{alignItems: "center"}}>
            <ContentCopyIcon sx={{fontSize: 16}} />
            Copy
          </Stack>
        </Link>
      )}
    </Stack>
  );
}
