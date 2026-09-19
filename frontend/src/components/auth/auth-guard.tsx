"use client";

import * as React from "react";
import {useRouter} from "next/navigation";

import {paths} from "@/paths";
import {useAuth} from "@/contexts/auth-context";

/**
 * Blocks rendering of protected subtrees until the user is authenticated.
 * While the session is being resolved nothing is rendered (no flash of the
 * protected page).
 */
export function AuthGuard({children}: {children: React.ReactNode}): React.JSX.Element | null {
  const {user, status} = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "guest") {
      router.replace(paths.auth.signIn);
    }
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return null;
  }

  return <React.Fragment>{children}</React.Fragment>;
}
