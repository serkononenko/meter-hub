import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

import {paths} from "@/paths";
import {REFRESH_COOKIE} from "@/lib/auth/session";
import {RegisterDisplay} from "@/components/register/register-display";

/**
 * Landing page: the register display is the hero — the product is the
 * number on the meter, so the first thing on the page is the number.
 * A signed-in user (refresh cookie present) skips the pitch and goes
 * straight to the app; a stale cookie degrades gracefully — AuthGuard's
 * silent refresh fails and sends them to sign-in.
 */
export default async function Home() {
  const hasSession = (await cookies()).has(REFRESH_COOKIE);
  if (hasSession) {
    redirect(paths.households);
  }

  return (
    <Box sx={{minHeight: "100dvh", display: "flex", flexDirection: "column"}}>
      <AppBar position="static" color="transparent" variant="outlined">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{flexGrow: 1}}>
            MeterHub
          </Typography>
          <Button color="inherit" href={paths.auth.signIn}>
            Sign in
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{flexGrow: 1, display: "flex", alignItems: "center"}}>
        <Stack spacing={4} sx={{width: "100%", py: 8}}>
          <RegisterDisplay size={72} value="0043187" />
          <Typography variant="h1" component="h1" sx={{textWrap: "balance"}}>
            Read your meters. Remember every number.
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{maxWidth: "46ch"}}>
            MeterHub keeps a history of electricity, gas, and water readings
            for every household — and refuses values that would move a meter
            backwards.
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" size="large" href={paths.auth.signIn}>
              Sign in
            </Button>
            <Button variant="outlined" size="large" href={paths.auth.signUp}>
              Register
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
