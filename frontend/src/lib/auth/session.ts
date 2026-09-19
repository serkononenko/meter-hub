/**
 * Session cookie contract shared by the BFF route handlers. The refresh
 * token is single-use and rotated by the identity service on every refresh,
 * so the cookie value is replaced on each successful refresh.
 */
export const REFRESH_COOKIE = "meterhub_refresh";

/** Access token TTL reported by the identity service (login/refresh). */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  status: "ACTIVE" | "DISABLED" | "LOCKED";
  createdAt: string;
  updatedAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: SessionUser;
}

/** RFC 9457 problem+json body returned by the backend services. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: {field: string; message: string}[];
  correlationId?: string;
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  } as const;
}

/** Extracts the human-readable message from an RFC 9457 problem response. */
export function problemMessage(problem: ProblemDetail): string {
  if (problem.errors && problem.errors.length > 0) {
    return problem.errors.map((e) => e.message).join(", ");
  }
  return problem.detail ?? problem.title ?? "Request failed";
}
