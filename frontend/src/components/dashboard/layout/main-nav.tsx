"use client";

import * as React from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import MenuIcon from "@mui/icons-material/Menu";

import {MobileNav} from "./mobile-nav";

/** Top bar of the dashboard shell, ported from the Devias Kit. The user
 * popover (sign-out, account) is wired up with the auth UI in task 7.2. */
export function MainNav(): React.JSX.Element {
  const [openNav, setOpenNav] = React.useState<boolean>(false);

  return (
    <React.Fragment>
      <Box
        component="header"
        sx={{
          borderBottom: "1px solid var(--mui-palette-divider)",
          backgroundColor: "var(--mui-palette-background-paper)",
          position: "sticky",
          top: 0,
          zIndex: "var(--MainNav-zIndex)",
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{alignItems: "center", justifyContent: "space-between", minHeight: "64px", px: 2}}
        >
          <Stack sx={{alignItems: "center"}} direction="row" spacing={2}>
            <IconButton
              onClick={(): void => {
                setOpenNav(true);
              }}
              sx={{display: {lg: "none"}}}
            >
              <MenuIcon />
            </IconButton>
          </Stack>
          <Stack sx={{alignItems: "center"}} direction="row" spacing={2}>
            <Avatar sx={{cursor: "pointer"}} />
          </Stack>
        </Stack>
      </Box>
      <MobileNav
        onClose={() => {
          setOpenNav(false);
        }}
        open={openNav}
      />
    </React.Fragment>
  );
}
