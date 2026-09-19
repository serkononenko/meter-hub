"use client";

import * as React from "react";
import {useRouter} from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

import {paths} from "@/paths";
import {useAuth} from "@/contexts/auth-context";

/**
 * Blocks rendering of protected subtrees until the user is authenticated.
 * While the session is being resolved a centered spinner is rendered (no
 * flash of the protected page, and no blank page on hard refresh).
 */
export function AuthGuard({children}: {children: React.ReactNode}): React.JSX.Element | null {
  const {user, status} = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "guest") {
      router.replace(paths.auth.signIn);
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <Box sx={{alignItems: "center", display: "flex", minHeight: "100vh", justifyContent: "center"}}>
        <CircularProgress aria-label="Loading" size={32} />
      </Box>
    );
  }

  if (status !== "authenticated" || !user) {
    return null;
  }

  return <React.Fragment>{children}</React.Fragment>;
}
