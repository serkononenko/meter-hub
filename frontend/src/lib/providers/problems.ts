/**
 * Maps provider-service problem `type` slugs to plain-language messages.
 * Unmapped types fall back to the problem's own detail/title via
 * problemMessage.
 */
const PROVIDER_PROBLEM_MESSAGES: Record<string, string> = {
  ACCOUNT_ARCHIVED: "This account is archived and can no longer be changed.",
  PROVIDER_ARCHIVED: "This provider is archived and can no longer be changed.",
  BINDING_ALREADY_ENDED: "This binding has already ended.",
  INVALID_BINDING_PERIOD: "The end date must not be before the start date.",
  INVALID_SUBMISSION_RULE: "The submission window is not valid — the closing day must not overlap the opening day.",
  METER_NOT_FOUND: "The meter could not be found.",
  METER_SERVICE_UNAVAILABLE: "Meter service is not reachable right now — try again in a moment.",
  HOUSEHOLD_MISMATCH: "This record belongs to a different household.",
  FORBIDDEN_SYSTEM_ROLE: "Only administrators can manage the provider catalog.",
};

export function providerProblemMessage(problem: {type?: string; detail?: string; title?: string}): string {
  const slug = problem.type?.split("/").pop();
  return (slug && PROVIDER_PROBLEM_MESSAGES[slug]) || problem.detail || problem.title || "Request failed";
}
