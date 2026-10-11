"use client";

import * as React from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";

import {isErrorResponse} from "@/lib/api/problems";
import {useListProviderAccounts} from "@/lib/api/generated/provider-service";
import type {ProviderAccount} from "@/lib/api/generated/provider-service/model";
import {formatRuleInWords} from "@/lib/providers/labels";

import {AccountCreateDialog} from "./account-create-dialog";
import {AccountEditDialog} from "./account-edit-dialog";

interface ProviderAccountsPanelProps {
  /** False for VIEWERs: write affordances are hidden (the API rejects as backstop). */
  canWrite?: boolean;
  householdId: string;
}

/**
 * Provider accounts of one household: the electricity/gas/water company
 * accounts with their submission rules in plain language. VIEWERs see the
 * list without write affordances.
 */
export function ProviderAccountsPanel({canWrite = true, householdId}: ProviderAccountsPanelProps): React.JSX.Element {
  const accountsQuery = useListProviderAccounts({householdId});
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editAccount, setEditAccount] = React.useState<ProviderAccount | null>(null);

  const response = accountsQuery.data;

  if (accountsQuery.isPending) {
    return <Skeleton height={140} variant="rounded" />;
  }

  if (accountsQuery.isError || !response || isErrorResponse(response)) {
    return (
      <Card>
        <CardContent>
          <Typography color="error" variant="body2">
            Could not load provider accounts.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const accounts = response.data;

  return (
    <Stack spacing={2}>
      {canWrite ? (
        <Stack direction="row" sx={{justifyContent: "flex-end"}}>
          <Button onClick={() => setCreateOpen(true)} startIcon={<AddIcon />} variant="contained">
            Add account
          </Button>
        </Stack>
      ) : null}
      {accounts.length === 0 ? (
        <Card>
          <CardContent>
            <Stack spacing={1} sx={{alignItems: "center", py: 4}}>
              <Typography variant="h6">No provider accounts yet</Typography>
              <Typography color="text.secondary" sx={{textAlign: "center"}} variant="body2">
                Link an account with your provider to see when meter readings
                are due.
              </Typography>
              {canWrite ? (
                <Button onClick={() => setCreateOpen(true)} startIcon={<AddIcon />} variant="contained">
                  Add account
                </Button>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2} sx={{display: "grid", gap: 2, gridTemplateColumns: {md: "repeat(2, 1fr)"}}}>
          {accounts.map((account) => (
            <AccountCard
              account={account}
              canWrite={canWrite}
              key={account.id}
              onEdit={() => setEditAccount(account)}
            />
          ))}
        </Stack>
      )}
      {createOpen ? (
        <AccountCreateDialog householdId={householdId} onClose={() => setCreateOpen(false)} open />
      ) : null}
      {editAccount ? (
        <AccountEditDialog
          account={editAccount}
          householdId={householdId}
          key={editAccount.id}
          onClose={() => setEditAccount(null)}
          open
        />
      ) : null}
    </Stack>
  );
}

function AccountCard({account, canWrite, onEdit}: {account: ProviderAccount; canWrite: boolean; onEdit: () => void}): React.JSX.Element {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} sx={{alignItems: "center", justifyContent: "space-between"}}>
            <Typography variant="h6">{account.label}</Typography>
            {account.archived ? <Chip color="default" label="Archived" size="small" /> : null}
          </Stack>
          {account.accountNumber ? (
            <Typography color="text.secondary" variant="body2">
              Account{" "}
              <Box sx={{fontFamily: "var(--font-spline-mono), monospace"}} component="span">
                {account.accountNumber}
              </Box>
            </Typography>
          ) : null}
          <Typography color="text.secondary" variant="body2">
            Readings due: {formatRuleInWords(account.rule)}.
          </Typography>
          {canWrite ? (
            <Button onClick={onEdit} size="small" startIcon={<EditIcon />}>
              Edit
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
