import {NextRequest, NextResponse} from "next/server";

import {REFRESH_COOKIE} from "@/lib/auth/session";

/**
 * BFF session check: returns whether a refresh-token cookie exists. The
 * client uses this on boot to decide between silent refresh and the sign-in
 * page. (It cannot validate the token itself — that happens on refresh.)
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const hasSession = _request.cookies.has(REFRESH_COOKIE);

  return NextResponse.json({hasSession});
}
