import type {Metadata} from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {HouseholdsList} from "@/components/households/households-list";
import {AppShell} from "@/components/layout/app-shell";

export const metadata = {title: "Households | MeterHub"} satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <AppShell>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Typography variant="h4">Households</Typography>
          <Typography color="text.secondary" variant="body2">
            Households you own. Open one to see its details and meters.
          </Typography>
        </Stack>
        <HouseholdsList />
      </Stack>
    </AppShell>
  );
}
