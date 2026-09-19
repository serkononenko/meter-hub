import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";

import {refreshToken as refreshTokenApi} from "@/lib/api/generated/identity-service/auth/auth";
import {REFRESH_COOKIE, cookieOptions} from "@/lib/auth/session";

/**
 * BFF silent refresh: presents the httpOnly cookie's refresh token to the
 * identity service via the generated client. The refresh token is
 * single-use, so a successful call rotates the cookie; a failed call
 * clears it (forces re-login).
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      {title: "Unauthorized", detail: "No active session", status: 401},
      {status: 401},
    );
  }

  try {
    const response = await refreshTokenApi({refreshToken});

    if (response.status !== 200) {
      store.delete(REFRESH_COOKIE);
      return NextResponse.json(
        {title: "Unauthorized", detail: "Session expired", status: 401},
        {status: 401},
      );
    }

    const login = response.data;
    store.set(REFRESH_COOKIE, login.refreshToken, cookieOptions(60 * 60 * 24 * 30));

    return NextResponse.json({
      accessToken: login.accessToken,
      expiresIn: login.expiresIn,
      user: login.user,
    });
  } catch {
    // Invalid/expired/rotated token: the session is unrecoverable.
    store.delete(REFRESH_COOKIE);

    return NextResponse.json(
      {title: "Unauthorized", detail: "Session expired", status: 401},
      {status: 401},
    );
  }
}
