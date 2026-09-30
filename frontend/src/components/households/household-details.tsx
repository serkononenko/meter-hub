"use client";

import * as React from "react";
import {useParams} from "next/navigation";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {isErrorResponse, problemMessage} from "@/lib/api/problems";
import {useGetHousehold} from "@/lib/api/generated/household-service";
import {householdRoleLabels} from "@/lib/households/labels";
import {MetersList} from "@/components/meters/meters-list";
import {MembersPanel} from "./members-panel";

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Household details: identity and timestamps of a single household. Meters
 * of this household arrive with the meters UI task.
 */
export function HouseholdDetails(): React.JSX.Element {
  const params = useParams<{householdId: string}>();
  const householdId = params.householdId;

  const householdQuery = useGetHousehold(householdId);
  const response = householdQuery.data;

  if (householdQuery.isPending) {
    return <Skeleton height={160} variant="rounded" />;
  }

  if (householdQuery.isError || !response || isErrorResponse(response)) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2} sx={{alignItems: "flex-start"}}>
            <Typography color="error">
              {response && isErrorResponse(response)
                ? problemMessage(response.data)
                : "Could not load the household."}
            </Typography>
            <Button onClick={() => void householdQuery.refetch()} size="small" variant="outlined">
              Retry
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const household = response.data;
  const isOwner = household.role === "OWNER";

  return (
    <Stack spacing={4}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} sx={{alignItems: "center", justifyContent: "space-between"}}>
              <Typography variant="h5">{household.name}</Typography>
              <Chip
                color={household.role === "OWNER" ? "primary" : "default"}
                label={`You are ${householdRoleLabels[household.role].toLowerCase()}`}
                size="small"
                variant={household.role === "VIEWER" ? "outlined" : "filled"}
              />
            </Stack>
            <Stack spacing={1}>
              <DetailRow mono value={household.id} label="Household ID" />
              <DetailRow label="Created" value={formatDate(household.createdAt)} />
              {household.updatedAt ? (
                <DetailRow label="Last updated" value={formatDate(household.updatedAt)} />
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      <MetersList canWrite={household.role !== "VIEWER"} householdId={household.id} />
      {isOwner ? <MembersPanel householdId={household.id} /> : null}
    </Stack>
  );
}

function DetailRow({label, value, mono}: {label: string; value: string; mono?: boolean}): React.JSX.Element {
  return (
    <Stack direction="row" spacing={2}>
      <Typography color="text.secondary" sx={{width: 160, flexShrink: 0}} variant="body2">
        {label}
      </Typography>
      <Typography
        sx={mono ? {fontFamily: "var(--font-spline-mono), monospace"} : undefined}
        variant="body2"
      >
        {value}
      </Typography>
    </Stack>
  );
}
