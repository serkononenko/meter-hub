import {z} from "zod";

// Mirrors the identity-service contract: letters, digits, dots, underscores,
// hyphens; 3–100 chars.
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z
  .object({
    email: z.email("Enter a valid email address"),
    username: z
      .string()
      .min(1, "Username is required")
      .regex(USERNAME_PATTERN, "Letters, digits, dots, underscores, and hyphens only")
      .min(3, "At least 3 characters")
      .max(100, "At most 100 characters"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.confirmPassword === values.password, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

/** Flattens a failed parse into the per-field string map the forms render. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in result)) {
      result[key] = issue.message;
    }
  }
  return result;
}
