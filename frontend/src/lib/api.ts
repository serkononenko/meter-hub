/**
 * API access configuration. The browser talks only to the Next.js BFF layer
 * (`/api/auth/*`); the refresh token lives in an httpOnly cookie and never
 * reaches client JS. Server-side route handlers call the API gateway with
 * GATEWAY_URL (see .env.example).
 */
export const API_BASE_URL = "/api";

/** Server-only: base URL of the MeterHub API gateway. */
export const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

export const API_ENDPOINTS = {
  // BFF endpoints (browser-facing)
  login: `${API_BASE_URL}/auth/login`,
  signUp: `${API_BASE_URL}/auth/sign-up`,
  logout: `${API_BASE_URL}/auth/logout`,
  refresh: `${API_BASE_URL}/auth/refresh`,
  session: `${API_BASE_URL}/auth/session`,
} as const;
