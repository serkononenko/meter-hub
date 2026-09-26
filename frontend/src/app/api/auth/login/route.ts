import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";

import {loginUser} from "@/lib/api/generated/identity-service/auth/auth";
import {forwardedForHeaders} from "@/lib/api/forwarded-for";
import type {Problem} from "@/lib/api/generated/identity-service/model";
import {REFRESH_COOKIE, cookieOptions} from "@/lib/auth/session";

/** BFF login: calls the identity service via the generated client and
 * stores the refresh token in an httpOnly cookie. The access token is
 * returned in the body for the client to hold in memory only. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: {email?: string; password?: string};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {title: "Bad Request", detail: "Malformed JSON body", status: 400},
      {status: 400},
    );
  }

  try {
    const response = await loginUser(
      {email: body.email ?? "", password: body.password ?? ""},
      {headers: forwardedForHeaders(request)},
    );

    if (response.status !== 200) {
      // Pass the identity service's problem detail through (e.g. "Email or
      // password is incorrect.").
      const problem = response.data as Problem;
      return NextResponse.json(
        {
          title: problem.title ?? "Unauthorized",
          detail: problem.detail ?? "Sign in failed",
          status: response.status,
        },
        {status: response.status},
      );
    }

    const login = response.data;
    const store = await cookies();
    store.set(REFRESH_COOKIE, login.refreshToken, cookieOptions(60 * 60 * 24 * 30));

    return NextResponse.json({
      accessToken: login.accessToken,
      expiresIn: login.expiresIn,
      user: login.user,
    });
  } catch {
    return NextResponse.json(
      {title: "Internal Server Error", detail: "Sign in failed", status: 500},
      {status: 500},
    );
  }
}
