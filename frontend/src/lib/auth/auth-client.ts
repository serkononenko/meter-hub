"use client";

import {
  registerUser,
} from "@/lib/api/generated/identity-service/auth/auth";
import type {User} from "@/lib/api/generated/identity-service/model";
import {fieldErrorsOf, isErrorResponse, problemMessage} from "@/lib/api/problems";
import type {SessionUser} from "@/lib/auth/session-user";

export type {SessionUser};

/**
 * Browser-side auth client built on the Orval-generated identity-service
 * calls. Registration goes straight to the API (no tokens involved); login
 * and refresh go through the BFF routes because the refresh token must
 * only ever travel as an httpOnly cookie — the generated login response
 * carries it in the body, so only server-side code may call that raw
 * function.
 */

let accessToken: string | null = null;
let refreshPromise: Promise<SessionUser | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}

/**
 * Silent refresh via the BFF. Concurrent callers share one request.
 * Returns the refreshed user, or null when the session is unrecoverable.
 */
export async function refreshSession(): Promise<SessionUser | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch("/api/auth/refresh", {method: "POST"});
        if (!response.ok) {
          accessToken = null;
          return null;
        }
        const payload = (await response.json()) as {accessToken: string; user: SessionUser};
        accessToken = payload.accessToken;
        return payload.user;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function login(email: string, password: string): Promise<{ok: true; user: SessionUser} | {ok: false; error: string}> {
  try {
    // Through the BFF: sets the httpOnly refresh cookie server-side and
    // returns accessToken + user without the refresh token.
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email, password}),
    });

    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as {detail?: string} | null;
      return {ok: false, error: problem?.detail ?? "Sign in failed"};
    }

    const payload = (await response.json()) as {accessToken: string; user: SessionUser};
    accessToken = payload.accessToken;
    return {ok: true, user: payload.user};
  } catch {
    return {ok: false, error: "Sign in failed"};
  }
}

export async function signUp(values: {
  email: string;
  username: string;
  password: string;
}): Promise<{ok: true} | {ok: false; error: string; fieldErrors?: Record<string, string>}> {
  try {
    // Generated identity call — registration involves no tokens, so the
    // browser can hit the API directly (relative URL via Next rewrite).
    const response = await registerUser(values);

    if (isErrorResponse(response)) {
      return {
        ok: false,
        error: problemMessage(response.data),
        fieldErrors: fieldErrorsOf(response.data),
      };
    }

    return {ok: true};
  } catch {
    return {ok: false, error: "Registration failed"};
  }
}

export async function logout(): Promise<void> {
  try {
    // The BFF route revokes the refresh token server-side (it reads the
    // httpOnly cookie) and clears the cookie.
    await fetch("/api/auth/logout", {method: "POST"});
  } finally {
    accessToken = null;
  }
}

export type {User};
