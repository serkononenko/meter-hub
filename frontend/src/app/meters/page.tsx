import type {Metadata} from "next";
import * as React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {AppShell} from "@/components/layout/app-shell";

export const metadata = {title: "Meters | MeterHub"} satisfies Metadata;

/** Placeholder — implemented in upcoming frontend tasks. */
export default function Page(): React.JSX.Element {
  return (
    <AppShell>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Typography variant="h4">Meters</Typography>
          <Typography color="text.secondary" variant="body2">
            Coming soon.
          </Typography>
        </Stack>
      </Stack>
    </AppShell>
  );
}
