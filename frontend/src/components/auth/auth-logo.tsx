"use client";

import RouterLink from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/** Text logo used on auth pages and in the navs. */
export function AuthLogo({href}: {href: string}): React.JSX.Element {
  return (
    <Box component={RouterLink} href={href} sx={{display: "inline-flex", textDecoration: "none"}}>
      <Typography variant="h5" sx={{fontWeight: 700, letterSpacing: "-0.5px"}}>
        MeterHub
      </Typography>
    </Box>
  );
}
