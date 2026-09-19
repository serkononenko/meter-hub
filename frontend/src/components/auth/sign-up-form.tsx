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
import {signUp} from "@/lib/auth/auth-client";

interface Values {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

const defaultValues: Values = {email: "", username: "", password: "", confirmPassword: ""};

// Mirrors the identity-service contract: letters, digits, dots, underscores,
// hyphens; 3–100 chars.
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export function SignUpForm(): React.JSX.Element {
  const router = useRouter();

  const [values, setValues] = React.useState<Values>(defaultValues);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Values, string>> & {root?: string}>({});
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
      if (!values.username) {
        nextErrors.username = "Username is required";
      } else if (!USERNAME_PATTERN.test(values.username)) {
        nextErrors.username = "Letters, digits, dots, underscores, and hyphens only";
      } else if (values.username.length < 3) {
        nextErrors.username = "At least 3 characters";
      }
      if (values.password.length < 8) {
        nextErrors.password = "At least 8 characters";
      }
      if (values.confirmPassword !== values.password) {
        nextErrors.confirmPassword = "Passwords do not match";
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      setIsPending(true);

      const result = await signUp({
        email: values.email,
        username: values.username,
        password: values.password,
      });

      if (!result.ok) {
        setErrors({root: result.error, ...result.fieldErrors});
        setIsPending(false);
        return;
      }

      // Registration does not sign in; send the user to sign-in with the
      // email prefilled via query param.
      router.replace(`${paths.auth.signIn}?email=${encodeURIComponent(values.email)}`);
    },
    [values, router],
  );

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h4">Sign up</Typography>
        <Typography color="text.secondary" variant="body2">
          Already have an account?{" "}
          <Link href={paths.auth.signIn} variant="subtitle2">
            Sign in
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
          <FormControl error={Boolean(errors.username)}>
            <InputLabel>Username</InputLabel>
            <OutlinedInput
              label="Username"
              value={values.username}
              onChange={(event) => setValues((prev) => ({...prev, username: event.target.value}))}
            />
            {errors.username ? <FormHelperText>{errors.username}</FormHelperText> : null}
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
          <FormControl error={Boolean(errors.confirmPassword)}>
            <InputLabel>Confirm password</InputLabel>
            <OutlinedInput
              type={showPassword ? "text" : "password"}
              label="Confirm password"
              value={values.confirmPassword}
              onChange={(event) => setValues((prev) => ({...prev, confirmPassword: event.target.value}))}
            />
            {errors.confirmPassword ? <FormHelperText>{errors.confirmPassword}</FormHelperText> : null}
          </FormControl>
          {errors.root ? <Alert color="error">{errors.root}</Alert> : null}
          <Button loading={isPending} type="submit" variant="contained">
            Sign up
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
