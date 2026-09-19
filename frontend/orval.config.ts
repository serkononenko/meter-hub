import {defineConfig} from "orval";

/**
 * Generates a TanStack Query client from the versioned contracts in
 * contracts/openapi/services. Each service gets its own output module under
 * src/lib/api/generated. All requests go through the custom fetch mutator,
 * which attaches the in-memory access token and silently refreshes on 401.
 */

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
      // NOTE: contract paths already start with /api/v1, so no baseUrl here.
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
