"use client";

import * as React from "react";
import {useRouter} from "next/navigation";

import {paths} from "@/paths";
import {useAuth} from "@/contexts/auth-context";

/** Keeps authenticated users off the auth pages (sign-in/sign-up). */
export function GuestGuard({children}: {children: React.ReactNode}): React.JSX.Element | null {
  const {user, status} = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(paths.households);
    }
  }, [status, user, router]);

  if (status === "authenticated" && user) {
    return null;
  }

  return <React.Fragment>{children}</React.Fragment>;
}
