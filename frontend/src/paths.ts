/** Central route table (pattern from the Devias Kit). */
export const paths = {
  home: "/",
  auth: {signIn: "/auth/sign-in", signUp: "/auth/sign-up"},
  /** Post-login landing view. */
  households: "/households",
  readings: "/readings",
  settings: "/settings",
  errors: {notFound: "/errors/not-found"},
} as const;

/** Route helper for a single household. */
export function householdPath(householdId: string): string {
  return `${paths.households}/${householdId}`;
}
