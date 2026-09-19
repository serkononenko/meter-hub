import type {Problem} from "@/lib/api/generated/identity-service/model";

/**
 * Narrowing helpers for Orval's fetch-client response unions: every call
 * resolves to {data, status}, and statuses >= 400 carry a problem+json body.
 */

export function isErrorResponse(
  response: unknown,
): response is {data: Problem; status: number} {
  return (
    typeof response === "object" &&
    response !== null &&
    "status" in response &&
    typeof (response as {status: unknown}).status === "number" &&
    (response as {status: number}).status >= 400
  );
}

export function problemMessage(problem: Pick<Problem, "detail" | "title" | "errors"> | null | undefined): string {
  if (problem?.errors && problem.errors.length > 0) {
    return problem.errors.map((e) => e.message).join(", ");
  }
  return problem?.detail ?? problem?.title ?? "Request failed";
}

export function fieldErrorsOf(problem: Problem | null | undefined): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const problemError of problem?.errors ?? []) {
    fieldErrors[problemError.field] = problemError.message;
  }
  return fieldErrors;
}
