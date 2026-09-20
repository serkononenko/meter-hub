import type {NextConfig} from "next";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // Minimal self-contained server (.next/standalone) for the Docker image —
  // the runner stage copies it without node_modules (frontend/Dockerfile).
  output: "standalone",
  // Proxy API calls to the gateway: browser code uses relative /api/<service>
  // URLs (same-origin, no CORS), the Next server forwards them. Server-side
  // callers (BFF route handlers) call the gateway directly instead. The
  // filesystem BFF routes under /api/auth/* take precedence over rewrites.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${GATEWAY_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
