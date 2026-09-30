"use client";

import * as React from "react";
import RouterLink from "next/link";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";

import {householdPath} from "@/paths";
import {isErrorResponse, problemMessage} from "@/lib/api/problems";
import {useListHouseholds} from "@/lib/api/generated/household-service";
import {householdRoleLabels} from "@/lib/households/labels";

import {HouseholdCreateDialog} from "./household-create-dialog";
import {HouseholdJoinDialog} from "./household-join-dialog";

/**
 * Household list: one card per household of the signed-in user, with an
 * empty state that invites creating the first one.
 */
export function HouseholdsList(): React.JSX.Element {
  const householdsQuery = useListHouseholds();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [joinOpen, setJoinOpen] = React.useState(false);

  const response = householdsQuery.data;

  if (householdsQuery.isPending) {
    return (
      <Stack spacing={2}>
        <Skeleton height={120} variant="rounded" />
        <Skeleton height={120} variant="rounded" />
      </Stack>
    );
  }

  if (householdsQuery.isError || !response || isErrorResponse(response)) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2} sx={{alignItems: "flex-start"}}>
            <Typography color="error">
              {response && isErrorResponse(response)
                ? problemMessage(response.data)
                : "Could not load households."}
            </Typography>
            <Button onClick={() => void householdsQuery.refetch()} size="small" variant="outlined">
              Retry
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const households = response.data;

  return (
    <React.Fragment>
      <Stack direction="row" spacing={1.5} sx={{justifyContent: "flex-end"}}>
        <Button onClick={() => setJoinOpen(true)} variant="outlined">
          Join household
        </Button>
        <Button onClick={() => setCreateOpen(true)} startIcon={<AddIcon />} variant="contained">
          Create household
        </Button>
      </Stack>
      {households.length === 0 ? (
        <Card>
          <CardContent>
            <Stack spacing={1} sx={{alignItems: "center", py: 4}}>
              <Typography variant="h6">No households yet</Typography>
              <Typography color="text.secondary" sx={{textAlign: "center"}} variant="body2">
                Create your first household to start adding meters.
              </Typography>
              <Button onClick={() => setCreateOpen(true)} startIcon={<AddIcon />} variant="contained">
                Create household
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2} sx={{gridTemplateColumns: {md: "repeat(2, 1fr)"}, display: "grid", gap: 2}}>
          {households.map((household) => (
            <Card key={household.id}>
              <CardContent>
                <Stack direction="row" spacing={1.5} sx={{alignItems: "center", justifyContent: "space-between"}}>
                  <Typography variant="h6">
                    <RouterLink
                      href={householdPath(household.id)}
                      style={{color: "inherit", textDecoration: "none"}}
                    >
                      {household.name}
                    </RouterLink>
                  </Typography>
                  <Chip
                    color={household.role === "OWNER" ? "primary" : "default"}
                    label={householdRoleLabels[household.role]}
                    size="small"
                    variant={household.role === "VIEWER" ? "outlined" : "filled"}
                  />
                </Stack>
                <Typography color="text.secondary" variant="body2">
                  Created{" "}
                  {new Date(household.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Typography>
              </CardContent>
              <CardActions>
                <Button component={RouterLink} href={householdPath(household.id)} size="small">
                  View details
                </Button>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}
      <HouseholdCreateDialog onClose={() => setCreateOpen(false)} open={createOpen} />
      <HouseholdJoinDialog onClose={() => setJoinOpen(false)} open={joinOpen} />
    </React.Fragment>
  );
}
