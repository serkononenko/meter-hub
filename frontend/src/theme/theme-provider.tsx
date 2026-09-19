"use client";

import * as React from "react";
import {ThemeProvider} from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";

/**
 * Client boundary for the MUI theme: applies CssBaseline and both color
 * schemes to the whole app (MUI Next.js integration, App Router setup).
 */
export default function ThemeProviderBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
