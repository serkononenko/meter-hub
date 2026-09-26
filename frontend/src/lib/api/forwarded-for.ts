import type {NextRequest} from "next/server";

/**
 * Builds the headers the BFF forwards to the gateway so IP-keyed rate
 * limiting (docs/service-boundaries.md §1) sees the browser's address
 * instead of this Next.js server's. Without it every client would share
 * one auth bucket keyed on the web container's IP.
 *
 * Best effort: the value is whatever upstream proxy headers reached this
 * server. A direct browser connection supplies no X-Forwarded-For, and the
 * gateway then falls back to the connection's remote address (the web
 * container's IP) — all such clients share one bucket, which fails closed.
 */
export function forwardedForHeaders(request: NextRequest): Record<string, string> {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return {"x-forwarded-for": forwardedFor};
  }
  return {};
}
