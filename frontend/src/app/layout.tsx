import type {Metadata} from "next";
import {AppRouterCacheProvider} from "@mui/material-nextjs/v16-appRouter";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import ThemeProviderBoundary from "../theme/theme-provider";

import {QueryProvider} from "@/components/query-provider";
import {AuthProvider} from "@/contexts/auth-context";
import {bricolage, splineMono} from "@/lib/fonts";
import "@/styles/global.css";

export const metadata: Metadata = {
  title: "MeterHub",
  description: "Home metering: households, meters, and readings.",
};

export default function RootLayout({children}: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${splineMono.variable}`} suppressHydrationWarning>
      <body>
        {/* Runs before hydration so the color scheme matches the system
            preference without a flash. */}
        <InitColorSchemeScript attribute="data" />
        <AppRouterCacheProvider options={{key: "mhu", enableCssLayer: true}}>
          <ThemeProviderBoundary>
            <QueryProvider>
              <AuthProvider>{children}</AuthProvider>
            </QueryProvider>
          </ThemeProviderBoundary>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
