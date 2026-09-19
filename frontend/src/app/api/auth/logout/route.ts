import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";

import {logoutUser} from "@/lib/api/generated/identity-service/auth/auth";
import {REFRESH_COOKIE, cookieOptions} from "@/lib/auth/session";

/**
 * BFF logout: revokes the refresh token server-side via the generated
 * client (invalid tokens are ignored by the identity service) and clears
 * the cookie.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    // Best effort: even if this fails, the cookie is cleared client-side.
    await logoutUser({refreshToken}).catch(() => undefined);
  }

  store.set(REFRESH_COOKIE, "", cookieOptions(0));

  return new NextResponse(null, {status: 204});
}
