"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {useAuth} from "@/contexts/auth-context";
import {isAdmin} from "@/lib/auth/roles";
import {paths} from "@/paths";

/**
 * Renders its children only for ADMIN system-role users; everyone else
 * sees a short explanation. The API enforces the same rule as backstop.
 */
export function AdminGate({children}: {children: React.ReactNode}): React.JSX.Element {
  const {user, status} = useAuth();

  if (status === "loading") {
    return <Box sx={{minHeight: "40vh"}} />;
  }

  if (!isAdmin(user)) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={1} sx={{py: 2}}>
            <Typography variant="h6">Administrators only</Typography>
            <Typography color="text.secondary" variant="body2">
              The provider catalog is managed by MeterHub administrators.{" "}
              <Typography
                component="a"
                href={paths.households}
                sx={{whiteSpace: "nowrap"}}
                variant="body2"
              >
                Back to households
              </Typography>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return <React.Fragment>{children}</React.Fragment>;
}
