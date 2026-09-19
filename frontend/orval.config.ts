import {defineConfig} from "orval";

/**
 * Generates a TanStack Query client from the versioned contracts in
 * contracts/openapi/services. Each service gets its own output module under
 * src/lib/api/generated. All requests go through the custom fetch mutator,
 * which attaches the in-memory access token and silently refreshes on 401.
 */

/**
 * Maps a contract service name to the gateway route prefix that fronts it.
 * The gateway exposes each service under /api/<service-name>/** and strips
 * that prefix before forwarding (RewritePath), so a generated URL of
 * /api/meter-service/api/v1/meters reaches Meter Service as /api/v1/meters.
 */
const SERVICE_GATEWAY_PREFIX: Record<string, string> = {
  "identity-service": "/api/identity-service",
  "household-service": "/api/household-service",
  "meter-service": "/api/meter-service",
  "reading-service": "/api/reading-service",
};

function serviceConfig(name: string) {
  return {
    input: {
      target: `../contracts/openapi/services/${name}/openapi.yaml`,
      parserOptions: {
        // Service specs reference the shared root contract
        // (../../openapi.yaml) and the shared correlation-id header and
        // Problem schema.
        externalRefs: {
          allow: [
            "../../openapi.yaml",
            "../../components/headers/correlation-id.yaml",
            "../../components/schemas/problem.yaml",
          ],
        },
      },
    },
    output: {
      client: "react-query" as const,
      mode: "tags-split" as const,
      target: `src/lib/api/generated/${name}/${name}.ts`,
      schemas: `src/lib/api/generated/${name}/model`,
      httpClient: "fetch" as const,
      // Prepend the gateway route prefix to every contract path
      // (/api/v1/...) so browser calls route through the gateway.
      baseUrl: SERVICE_GATEWAY_PREFIX[name],
      override: {
        mutator: {
          path: "src/lib/api/orval-mutator.ts",
          name: "orvalInstance",
        },
      },
    },
  };
}

export default defineConfig({
  identity: serviceConfig("identity-service"),
  household: serviceConfig("household-service"),
  meter: serviceConfig("meter-service"),
  reading: serviceConfig("reading-service"),
});
