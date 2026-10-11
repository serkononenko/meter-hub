"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {useGetSubmissionWindows} from "@/lib/api/generated/provider-service";
import {isErrorResponse} from "@/lib/api/problems";
import {formatWindowRange, windowStatusOf} from "@/lib/providers/labels";

/**
 * Submission-window display for a meter, styled as a meter register: the
 * date range in Spline Sans Mono like a counter reading, with an open /
 * upcoming state chip. This is the one deliberate flourish of the
 * provider screens — everything around it stays quiet.
 */
export function SubmissionWindowCard({meterId}: {meterId: string}): React.JSX.Element {
  const windowsQuery = useGetSubmissionWindows({meterId});
  const response = windowsQuery.data;

  if (windowsQuery.isPending) {
    return <Skeleton height={72} variant="rounded" />;
  }

  if (windowsQuery.isError || !response || isErrorResponse(response)) {
    return (
      <Typography color="text.secondary" variant="body2">
        Submission windows are unavailable right now.
      </Typography>
    );
  }

  const {binding, current, next} = response.data;

  if (!binding) {
    return (
      <Typography color="text.secondary" variant="body2">
        No provider linked — connect one to see when readings are due.
      </Typography>
    );
  }

  const status = windowStatusOf(response.data);

  return (
    <Box
      sx={{
        bgcolor: "action.hover",
        borderLeft: "2px solid",
        borderColor: status?.state === "open" ? "primary.main" : "divider",
        px: 2,
        py: 1.5,
      }}
    >
      {status ? (
        <Stack direction="row" spacing={1.5} sx={{alignItems: "baseline", flexWrap: "wrap", rowGap: 0.5}}>
          <Typography
            component="span"
            sx={{fontFamily: "var(--font-spline-mono), monospace", fontSize: "1.1rem", fontWeight: 600}}
          >
            {formatWindowRange(status.window)}
          </Typography>
          <Chip
            color={status.state === "open" ? "primary" : "default"}
            label={status.state === "open" ? `Open — closes in ${status.endsInDays} d` : `Opens in ${status.startsInDays} d`}
            size="small"
            variant={status.state === "open" ? "filled" : "outlined"}
          />
          {current ? null : next ? (
            <Typography color="text.secondary" component="span" variant="caption">
              next window
            </Typography>
          ) : null}
        </Stack>
      ) : (
        <Typography color="text.secondary" variant="body2">
          No submission window scheduled for this account.
        </Typography>
      )}
    </Box>
  );
}
