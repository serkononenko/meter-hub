import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {paths} from "@/paths";
import {RegisterDisplay} from "@/components/register/register-display";
import {AuthLogo} from "./auth-logo";

export interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Split-screen auth layout ported from the Devias Kit: form on the left,
 * branded gradient panel on the right (hidden on small screens).
 */
export function AuthLayout({children}: AuthLayoutProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: {xs: "flex", lg: "grid"},
        flexDirection: "column",
        gridTemplateColumns: "1fr 1fr",
        minHeight: "100%",
      }}
    >
      <Box sx={{display: "flex", flex: "1 1 auto", flexDirection: "column"}}>
        <Box sx={{p: 3}}>
          <AuthLogo href={paths.home} />
        </Box>
        <Box sx={{alignItems: "center", display: "flex", flex: "1 1 auto", justifyContent: "center", p: 3}}>
          <Box sx={{maxWidth: "450px", width: "100%"}}>{children}</Box>
        </Box>
      </Box>
      <Box
        sx={{
          alignItems: "center",
          backgroundColor: "#0c1420",
          color: "var(--mui-palette-common-white)",
          display: {xs: "none", lg: "flex"},
          justifyContent: "center",
          p: 3,
        }}
      >
        <Stack spacing={4} sx={{alignItems: "flex-start"}}>
          <RegisterDisplay size={64} value="0043187" />
          <Stack spacing={1}>
            <Typography color="inherit" sx={{fontSize: "24px", lineHeight: "32px"}} variant="h1">
              Read your meters. Remember every number.
            </Typography>
            <Typography variant="subtitle1">
              Track household meters and keep your readings in one place.
            </Typography>
          </Stack>
          <Divider sx={{borderColor: "rgba(255, 255, 255, 0.12)", alignSelf: "stretch"}} />
          <Stack spacing={2} sx={{p: 2}}>
            <Typography color="var(--mui-palette-neutral-400)" variant="body2">
              Record electricity, gas, and water readings — the app refuses
              values that would move a meter backwards.
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
