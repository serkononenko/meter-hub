import * as React from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import GlobalStyles from "@mui/material/GlobalStyles";

import {MainNav} from "@/components/dashboard/layout/main-nav";
import {SideNav} from "@/components/dashboard/layout/side-nav";

/**
 * Dashboard shell, ported from the Devias Kit: fixed dark side nav plus a
 * sticky top bar. Auth gating arrives with task 7.2.
 */
export default function DashboardLayout({children}: {children: React.ReactNode}): React.JSX.Element {
  return (
    <React.Fragment>
      <GlobalStyles
        styles={{
          body: {
            "--MainNav-height": "56px",
            "--MainNav-zIndex": 1000,
            "--SideNav-width": "280px",
            "--SideNav-zIndex": 1100,
            "--MobileNav-width": "320px",
            "--MobileNav-zIndex": 1100,
          },
        }}
      />
      <Box
        sx={{
          bgcolor: "var(--mui-palette-background-default)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          minHeight: "100%",
        }}
      >
        <SideNav />
        <Box sx={{display: "flex", flex: "1 1 auto", flexDirection: "column", pl: {lg: "var(--SideNav-width)"}}}>
          <MainNav />
          <main>
            <Container maxWidth="xl" sx={{py: "64px"}}>
              {children}
            </Container>
          </main>
        </Box>
      </Box>
    </React.Fragment>
  );
}
