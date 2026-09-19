import type {Metadata} from "next";
import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export const metadata = {title: "Meters | MeterHub"} satisfies Metadata;

/** Placeholder — implemented in upcoming frontend tasks. */
export default function Page(): React.JSX.Element {
  return (
    <Box sx={{py: 4}}>
      <Typography variant="h4">Meters</Typography>
      <Typography color="text.secondary" variant="body2">
        Coming soon.
      </Typography>
    </Box>
  );
}
