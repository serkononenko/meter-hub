/** Central route table (pattern from the Devias Kit). */
export const paths = {
  home: "/",
  auth: {signIn: "/auth/sign-in", signUp: "/auth/sign-up"},
  dashboard: {
    overview: "/dashboard",
    meters: "/dashboard/meters",
    readings: "/dashboard/readings",
    settings: "/dashboard/settings",
  },
  errors: {notFound: "/errors/not-found"},
} as const;
