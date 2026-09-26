import {NextRequest, NextResponse} from "next/server";

import {registerUser} from "@/lib/api/generated/identity-service/auth/auth";
import type {Problem} from "@/lib/api/generated/identity-service/model";
import {forwardedForHeaders} from "@/lib/api/forwarded-for";

/** BFF registration: calls the identity service via the generated client.
 * Does NOT sign the user in — the register response carries no tokens; the
 * client redirects to sign-in afterwards. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: {email?: string; username?: string; password?: string};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {title: "Bad Request", detail: "Malformed JSON body", status: 400},
      {status: 400},
    );
  }

  try {
    const response = await registerUser(
      {
        email: body.email ?? "",
        username: body.username ?? "",
        password: body.password ?? "",
      },
      {headers: forwardedForHeaders(request)},
    );

    if (response.status !== 201) {
      const problem = response.data as Problem;
      return NextResponse.json(
        {
          title: problem.title ?? "Bad Request",
          detail: problem.detail ?? "Registration failed",
          errors: problem.errors,
          status: response.status,
        },
        {status: response.status},
      );
    }

    return NextResponse.json(response.data, {status: 201});
  } catch {
    return NextResponse.json(
      {title: "Internal Server Error", detail: "Registration failed", status: 500},
      {status: 500},
    );
  }
}
