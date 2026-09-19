import type {NextConfig} from "next";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // Proxy API calls to the gateway: browser code uses relative /api/v1 URLs
  // (same-origin, no CORS), the Next server forwards them. Server-side
  // callers (BFF route handlers) call the gateway directly instead.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${GATEWAY_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
