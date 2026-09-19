import type {Metadata} from "next";
import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export const metadata = {title: "Overview | MeterHub"} satisfies Metadata;

/**
 * Dashboard overview placeholder; real stat cards and charts arrive with the
 * readings UI tasks.
 */
export default function Page(): React.JSX.Element {
  return (
    <Box sx={{py: 4}}>
      <Typography variant="h4">Overview</Typography>
      <Typography color="text.secondary" variant="body2">
        Your meters and recent readings at a glance.
      </Typography>
    </Box>
  );
}
