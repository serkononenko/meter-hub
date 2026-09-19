"use client";

import * as React from "react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

/** TanStack Query provider for the Orval-generated hooks. */
export function QueryProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Reasonable defaults for a dashboard: no aggressive polling,
            // retry on transient failures but not on 4xx problem responses.
            staleTime: 30_000,
            retry: (failureCount, error) => {
              const status = (error as {status?: number}).status;
              if (status && status >= 400 && status < 500) {
                return false;
              }
              return failureCount < 3;
            },
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
