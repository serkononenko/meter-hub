import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

import {paths} from "@/paths";

/**
 * Landing page: basic layout and navigation shell. Sign-in and the household
 * views arrive with 7.2/7.3.
 */
export default function Home() {
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
        <Stack spacing={2} sx={{textAlign: "center", width: "100%", py: 8}}>
          <Typography variant="h1" component="h1">
            Home metering, simplified
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track electricity, gas, and water meters, record readings, and
            follow your usage over time.
          </Typography>
          <Stack direction="row" spacing={2} sx={{justifyContent: "center"}}>
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
