import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";

import {logoutUser} from "@/lib/api/generated/identity-service/auth/auth";
import {REFRESH_COOKIE, cookieOptions} from "@/lib/auth/session";
import {forwardedForHeaders} from "@/lib/api/forwarded-for";

/**
 * BFF logout: revokes the refresh token server-side via the generated
 * client (invalid tokens are ignored by the identity service) and clears
 * the cookie. When the browser forwards its in-memory access token, it is
 * passed through so identity records that token's revocation too (A4) —
 * the gateway stops accepting it within its poll interval instead of the
 * token living out its full 15-minute TTL.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  const accessToken = request.headers.get("authorization");

  if (refreshToken) {
    // Best effort: even if this fails, the cookie is cleared client-side.
    const headers = {
      ...forwardedForHeaders(request),
      ...(accessToken ? {Authorization: accessToken} : {}),
    };
    await logoutUser({refreshToken}, {headers}).catch(() => undefined);
  }

  store.set(REFRESH_COOKIE, "", cookieOptions(0));

  return new NextResponse(null, {status: 204});
}
