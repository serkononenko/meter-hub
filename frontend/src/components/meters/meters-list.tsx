"use client";

import * as React from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";

import {isErrorResponse, problemMessage} from "@/lib/api/problems";
import {
  useListMeters,
} from "@/lib/api/generated/meter-service";
import type {Meter} from "@/lib/api/generated/meter-service/model";
import {useGetLatestReading} from "@/lib/api/generated/reading-service";
import {meterStatusLabels, meterTypeLabels, formatReadingValue} from "@/lib/meters/labels";
import {meterTypeColor} from "@/theme/meter-type-colors";

import {ReadingsHistory} from "@/components/readings/readings-history";
import {ReadingCreateDialog} from "@/components/readings/reading-create-dialog";
import {MeterCreateDialog} from "./meter-create-dialog";
import {MeterEditDialog} from "./meter-edit-dialog";

export interface MetersListProps {
  householdId: string;
}

/**
 * Meters of one household: one card per meter with its type color, serial
 * number, and the latest reading. Includes the add-meter dialog and the
 * edit/archive action.
 */
export function MetersList({householdId}: MetersListProps): React.JSX.Element {
  const metersQuery = useListMeters({householdId});
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editMeter, setEditMeter] = React.useState<Meter | null>(null);

  const response = metersQuery.data;

  if (metersQuery.isPending) {
    return (
      <Stack spacing={2}>
        <Skeleton height={120} variant="rounded" />
        <Skeleton height={120} variant="rounded" />
      </Stack>
    );
  }

  if (metersQuery.isError || !response || isErrorResponse(response)) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2} sx={{alignItems: "flex-start"}}>
            <Typography color="error">
              {response && isErrorResponse(response)
                ? problemMessage(response.data)
                : "Could not load meters."}
            </Typography>
            <Button onClick={() => void metersQuery.refetch()} size="small" variant="outlined">
              Retry
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const meters = response.data;

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{justifyContent: "flex-end"}}>
        <Button onClick={() => setCreateOpen(true)} startIcon={<AddIcon />} variant="contained">
          Add meter
        </Button>
      </Stack>
      {meters.length === 0 ? (
        <Card>
          <CardContent>
            <Stack spacing={1} sx={{alignItems: "center", py: 4}}>
              <Typography variant="h6">No meters yet</Typography>
              <Typography color="text.secondary" sx={{textAlign: "center"}} variant="body2">
                Add the first meter of this household to start recording
                readings.
              </Typography>
              <Button onClick={() => setCreateOpen(true)} startIcon={<AddIcon />} variant="contained">
                Add meter
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2} sx={{display: "grid", gap: 2, gridTemplateColumns: {md: "repeat(2, 1fr)"}}}>
          {meters.map((meter) => (
            <MeterCard key={meter.id} meter={meter} onEdit={() => setEditMeter(meter)} />
          ))}
        </Stack>
      )}
      <MeterCreateDialog householdId={householdId} onClose={() => setCreateOpen(false)} open={createOpen} />
      {editMeter ? (
        <MeterEditDialog meter={editMeter} onClose={() => setEditMeter(null)} open={Boolean(editMeter)} />
      ) : null}
    </Stack>
  );
}

function MeterCard({meter, onEdit}: {meter: Meter; onEdit: () => void}): React.JSX.Element {
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  return (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} sx={{alignItems: "center", justifyContent: "space-between"}}>
            <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
              {/* Type color: the hue encodes the physical meter kind. */}
              <BoxColor color={meterTypeColor(meter.type)} />
              <Typography variant="h6">{meter.name}</Typography>
            </Stack>
            {meter.status === "ARCHIVED" ? (
              <Chip color="default" label={meterStatusLabels[meter.status]} size="small" />
            ) : null}
          </Stack>
          <Typography color="text.secondary" variant="body2">
            {meterTypeLabels[meter.type]} · Serial {meter.serialNumber}
          </Typography>
          <LatestReading meterId={meter.id} unit={meter.unit} />
          <ReadingsHistory meter={meter} open={historyOpen} />
        </Stack>
      </CardContent>
      <CardActions>
        <Button
          disabled={meter.status === "ARCHIVED"}
          onClick={() => setRecordOpen(true)}
          size="small"
          startIcon={<AddIcon />}
        >
          Record reading
        </Button>
        <Button
          onClick={() => setHistoryOpen((prev) => !prev)}
          size="small"
          startIcon={<HistoryIcon />}
        >
          {historyOpen ? "Hide history" : "History"}
        </Button>
        <Button onClick={onEdit} size="small" startIcon={<EditIcon />}>
          Edit or archive
        </Button>
      </CardActions>
      <ReadingCreateDialog meter={meter} onClose={() => setRecordOpen(false)} open={recordOpen} />
    </Card>
  );
}

/** A small color dot in the meter type's hue. */
function BoxColor({color}: {color: string}): React.JSX.Element {
  return (
    <Box
      aria-hidden
      sx={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Latest reading of a meter. The endpoint answers 404 before the first
 * reading exists — that's the "no readings yet" state, not an error.
 */
function LatestReading({meterId, unit}: {meterId: string; unit: Meter["unit"]}): React.JSX.Element {
  const latestQuery = useGetLatestReading(meterId);
  const response = latestQuery.data;

  if (latestQuery.isPending) {
    return <Skeleton height={32} width={140} variant="rounded" />;
  }

  if (latestQuery.isError || !response) {
    return (
      <Typography color="text.secondary" variant="body2">
        Could not load the latest reading.
      </Typography>
    );
  }

  if (isErrorResponse(response)) {
    return (
      <Typography color="text.secondary" variant="body2">
        No readings yet.
      </Typography>
    );
  }

  const reading = response.data;

  return (
    <Stack direction="row" spacing={1} sx={{alignItems: "baseline"}}>
      <Typography sx={{fontFamily: "var(--font-spline-mono), monospace"}} variant="body1">
        {formatReadingValue(reading.value, unit)}
      </Typography>
      <Typography color="text.secondary" variant="body2">
        {new Date(reading.recordedAt).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </Typography>
    </Stack>
  );
}
