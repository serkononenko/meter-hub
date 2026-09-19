"use client";

import * as React from "react";
import {useRouter} from "next/navigation";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/Logout";

import {paths} from "@/paths";
import {useAuth} from "@/contexts/auth-context";

export interface UserPopoverProps {
  anchorEl: Element | null;
  onClose: () => void;
  open: boolean;
}

/** Avatar menu with account info and sign-out, ported from the Devias Kit. */
export function UserPopover({anchorEl, onClose, open}: UserPopoverProps): React.JSX.Element {
  const {user, signOut} = useAuth();
  const router = useRouter();

  const handleSignOut = React.useCallback(async (): Promise<void> => {
    onClose();
    await signOut();
    // AuthGuard on protected routes reacts to the status change; the
    // refresh makes sure server components re-render for the guest state.
    router.replace(paths.home);
    router.refresh();
  }, [onClose, signOut, router]);

  return (
    <Popover
      anchorEl={anchorEl}
      anchorOrigin={{horizontal: "left", vertical: "bottom"}}
      onClose={onClose}
      open={open}
      slotProps={{paper: {sx: {width: "240px"}}}}
    >
      <Box sx={{px: 2, py: 1.5}}>
        <Typography variant="subtitle1">{user?.username ?? "Account"}</Typography>
        <Typography color="text.secondary" noWrap variant="body2">
          {user?.email}
        </Typography>
      </Box>
      <Divider />
      <MenuList>
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </MenuList>
    </Popover>
  );
}
