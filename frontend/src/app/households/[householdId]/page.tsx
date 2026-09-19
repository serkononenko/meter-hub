import type {Metadata} from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {HouseholdDetails} from "@/components/households/household-details";
import {AppShell} from "@/components/layout/app-shell";

export const metadata = {title: "Household | MeterHub"} satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <AppShell>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Typography variant="h4">Household</Typography>
          <Typography color="text.secondary" variant="body2">
            Details of this household.
          </Typography>
        </Stack>
        <HouseholdDetails />
      </Stack>
    </AppShell>
  );
}
