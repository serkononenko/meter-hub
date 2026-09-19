"use client";

import * as React from "react";
import {useParams} from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {isErrorResponse, problemMessage} from "@/lib/api/problems";
import {useGetHousehold} from "@/lib/api/generated/household-service";

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
          <Typography color="error">
            {response && isErrorResponse(response)
              ? problemMessage(response.data)
              : "Could not load the household."}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const household = response.data;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5">{household.name}</Typography>
          <Stack spacing={1}>
            <DetailRow label="Household ID" value={household.id} />
            <DetailRow label="Created" value={formatDate(household.createdAt)} />
            {household.updatedAt ? (
              <DetailRow label="Last updated" value={formatDate(household.updatedAt)} />
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function DetailRow({label, value}: {label: string; value: string}): React.JSX.Element {
  return (
    <Stack direction="row" spacing={2}>
      <Typography color="text.secondary" sx={{width: 160, flexShrink: 0}} variant="body2">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}
