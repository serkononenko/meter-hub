import {getAccessToken, refreshSession} from "@/lib/auth/auth-client";

/**
 * Custom instance used by all Orval-generated API calls.
 *
 * Browser: attaches the in-memory Bearer access token and retries once
 * through a silent refresh on 401, calling relative /api/v1 URLs (proxied
 * to the gateway by the Next.js rewrite).
 *
 * Server (BFF route handlers): the same generated functions are called
 * directly against the gateway, without token handling — the BFF decides
 * itself how to obtain tokens.
 *
 * Mirrors Orval's fetch httpClient contract: resolves to the response
 * union ({data, status}) with problem+json bodies as the error variants;
 * consumers narrow on `status`.
 */
const isServer = typeof window === "undefined";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

export const orvalInstance = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const absoluteUrl = isServer ? `${GATEWAY_URL}${url}` : url;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  let token: string | null = null;
  if (!isServer) {
    token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response = await fetch(absoluteUrl, {...options, headers});

  if (!isServer && response.status === 401) {
    const user = await refreshSession();
    if (user) {
      token = getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      response = await fetch(absoluteUrl, {...options, headers});
    }
  }

  const data = response.status === 204 ? undefined : await response.json().catch(() => undefined);

  // Cast: runtime shape {data, status} matches the generated response
  // union; the success/error variant is selected by `status` at runtime.
  return {data, status: response.status} as T;
};
