import type {Metadata} from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {AppShell} from "@/components/layout/app-shell";
import {AdminGate} from "@/components/auth/admin-gate";
import {CatalogManager} from "@/components/providers/catalog-manager";

export const metadata = {title: "Provider catalog | MeterHub"} satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <AppShell>
      <AdminGate>
        <Stack spacing={4}>
          <Stack spacing={1}>
            <Typography variant="h4">Provider catalog</Typography>
            <Typography color="text.secondary" variant="body2">
              Providers every household can pick, with suggested reading
              windows.
            </Typography>
          </Stack>
          <CatalogManager />
        </Stack>
      </AdminGate>
    </AppShell>
  );
}
