"use client";

import * as React from "react";

import {useGetCurrentUser} from "@/lib/api/generated/identity-service/users/users";
import type {User} from "@/lib/api/generated/identity-service/model";
import {
  clearAccessToken,
  getAccessToken,
  isErrorResponse,
  login,
  logout,
  refreshSession,
} from "@/lib/auth/auth-client";

type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<{ok: true} | {ok: false; error: string}>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/**
 * Holds the authenticated user in React state. The access token itself
 * lives in module memory (see auth-client); this context exists so guards
 * and layout components can render off `status`/`user`. The user profile
 * is fetched with the generated `useGetCurrentUser` hook once a session
 * exists.
 */
export function AuthProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const [status, setStatus] = React.useState<AuthStatus>("loading");

  // Populated once status is "authenticated"; disabled otherwise. Skips
  // while no access token exists (guests and the initial boot frame).
  const currentUserQuery = useGetCurrentUser({
    query: {
      enabled: status === "authenticated",
      retry: false,
      staleTime: Infinity,
    },
  });

  // The /users/me response union includes a Problem variant (e.g. 401
  // after the access token expired mid-flight); treat it as no user.
  const rawUser = currentUserQuery.data?.data;
  const user: User | null =
    rawUser && !isErrorResponse(rawUser) && "id" in rawUser ? rawUser : null;

  // Resolve the session on boot: silent refresh decides between
  // authenticated and guest. State updates only in the async continuation.
  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (getAccessToken()) {
          if (!cancelled) {
            setStatus("authenticated");
          }
          return;
        }

        const refreshedUser = await refreshSession();

        if (!cancelled) {
          setStatus(refreshedUser ? "authenticated" : "guest");
        }
      } catch {
        if (!cancelled) {
          clearAccessToken();
          setStatus("guest");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const result = await login(email, password);

    if (!result.ok) {
      return {ok: false as const, error: result.error};
    }

    // login() stored the access token; the /users/me query (enabled on
    // "authenticated") picks the profile up.
    setStatus("authenticated");
    return {ok: true as const};
  }, []);

  const signOut = React.useCallback(async (): Promise<void> => {
    await logout();
    setStatus("guest");
  }, []);

  const value = React.useMemo(
    () => ({user, status, signIn, signOut}),
    [user, status, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
