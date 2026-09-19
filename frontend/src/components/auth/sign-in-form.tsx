"use client";

import * as React from "react";
import {useRouter} from "next/navigation";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import {paths} from "@/paths";
import {useAuth} from "@/contexts/auth-context";

const defaultValues = {email: "", password: ""};

export function SignInForm(): React.JSX.Element {
  const {signIn} = useAuth();
  const router = useRouter();

  const [values, setValues] = React.useState(defaultValues);
  const [errors, setErrors] = React.useState<{email?: string; password?: string; root?: string}>({});
  const [showPassword, setShowPassword] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const submit = React.useCallback(
    async (event: React.FormEvent): Promise<void> => {
      event.preventDefault();
      setErrors({});

      const nextErrors: typeof errors = {};
      if (!values.email) {
        nextErrors.email = "Email is required";
      }
      if (!values.password) {
        nextErrors.password = "Password is required";
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      setIsPending(true);

      const result = await signIn(values.email, values.password);

      if (!result.ok) {
        setErrors({root: result.error});
        setIsPending(false);
        return;
      }

      // AuthGuard on the dashboard handles the redirect; refresh picks up
      // the new server components.
      router.replace(paths.households);
      router.refresh();
    },
    [values, signIn, router],
  );

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h4">Sign in</Typography>
        <Typography color="text.secondary" variant="body2">
          Don&apos;t have an account?{" "}
          <Link href={paths.auth.signUp} variant="subtitle2">
            Sign up
          </Link>
        </Typography>
      </Stack>
      <form onSubmit={submit}>
        <Stack spacing={2}>
          <FormControl error={Boolean(errors.email)}>
            <InputLabel>Email address</InputLabel>
            <OutlinedInput
              type="email"
              label="Email address"
              value={values.email}
              onChange={(event) => setValues((prev) => ({...prev, email: event.target.value}))}
            />
            {errors.email ? <FormHelperText>{errors.email}</FormHelperText> : null}
          </FormControl>
          <FormControl error={Boolean(errors.password)}>
            <InputLabel>Password</InputLabel>
            <OutlinedInput
              type={showPassword ? "text" : "password"}
              label="Password"
              value={values.password}
              onChange={(event) => setValues((prev) => ({...prev, password: event.target.value}))}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    edge="end"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              }
            />
            {errors.password ? <FormHelperText>{errors.password}</FormHelperText> : null}
          </FormControl>
          {errors.root ? <Alert color="error">{errors.root}</Alert> : null}
          <Button loading={isPending} type="submit" variant="contained">
            Sign in
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
