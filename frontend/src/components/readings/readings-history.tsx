"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {isErrorResponse} from "@/lib/api/problems";
import {useListReadings} from "@/lib/api/generated/reading-service";
import type {Reading} from "@/lib/api/generated/reading-service/model";
import type {Meter} from "@/lib/api/generated/meter-service/model";
import {formatReadingValue, meterUnitLabels} from "@/lib/meters/labels";

export interface ReadingsHistoryProps {
  meter: Meter;
  open: boolean;
}

/**
 * Collapsible reading history of one meter, newest first, kept to the most
 * recent page. Each row reads like the meter's logbook: when it was taken,
 * how much was consumed since the previous reading, and the counter value
 * itself. Consumption is what the household cares about; the counter value
 * is the evidence.
 */
export function ReadingsHistory({meter, open}: ReadingsHistoryProps): React.JSX.Element {
  // Load lazily: only fetch when the history is expanded the first time.
  const historyQuery = useListReadings(meter.id, undefined, {query: {enabled: open}});
  const response = historyQuery.data;

  return (
    <Collapse in={open} unmountOnExit>
      <Divider sx={{my: 1}} />
      <Stack spacing={1} sx={{pb: 1}}>
        {historyQuery.isPending ? (
          <Stack spacing={0.5}>
            <Skeleton height={24} variant="rounded" />
            <Skeleton height={24} variant="rounded" />
            <Skeleton height={24} variant="rounded" />
          </Stack>
        ) : historyQuery.isError || !response ? (
          <Stack spacing={1} sx={{alignItems: "flex-start"}}>
            <Typography color="error" variant="body2">
              Could not load the reading history.
            </Typography>
            <Button onClick={() => void historyQuery.refetch()} size="small" variant="outlined">
              Retry
            </Button>
          </Stack>
        ) : isErrorResponse(response) ? (
          <Typography color="text.secondary" variant="body2">
            {response.status === 404
              ? "This meter is no longer available."
              : "Could not load the reading history."}
          </Typography>
        ) : response.data.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No readings recorded yet.
          </Typography>
        ) : (
          <Stack component="ul" spacing={0.75} sx={{listStyle: "none", m: 0, p: 0}}>
            {withConsumption(response.data).map(({reading, consumption}) => (
              <Box
                component="li"
                key={reading.id}
                sx={{alignItems: "baseline", display: "flex", gap: 2, justifyContent: "space-between"}}
              >
                <Stack direction="row" spacing={1.5} sx={{alignItems: "baseline", minWidth: 0}}>
                  <Typography color="text.secondary" variant="body2" sx={{whiteSpace: "nowrap"}}>
                    {new Date(reading.recordedAt).toLocaleDateString(undefined, {dateStyle: "medium"})}
                  </Typography>
                  {consumption != null ? (
                    <Typography color="text.secondary" variant="body2" sx={{whiteSpace: "nowrap"}}>
                      +{consumption.toLocaleString(undefined, {maximumFractionDigits: 3})}{" "}
                      {meterUnitLabels[meter.unit]}
                    </Typography>
                  ) : null}
                </Stack>
                <Typography sx={{fontFamily: "var(--font-spline-mono), monospace"}} variant="body2">
                  {formatReadingValue(reading.value, meter.unit)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Collapse>
  );
}

/**
 * Pairs each reading with its consumption since the previous one. The API
 * returns readings newest-first, so the previous reading is the next entry;
 * the oldest row has no predecessor and gets none.
 */
function withConsumption(readings: Reading[]): Array<{reading: Reading; consumption: number | null}> {
  return readings.map((reading, index) => {
    const previous = readings[index + 1];
    return {
      reading,
      consumption: previous ? reading.value - previous.value : null,
    };
  });
}
