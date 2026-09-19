/**
 * Session user shape shared between the auth context and the generated
 * identity-service User model (structural alias so client code does not
 * have to import from generated modules directly).
 */
export interface SessionUser {
  id: string;
  email: string;
  username: string;
  status: "ACTIVE" | "DISABLED" | "LOCKED";
  createdAt: string;
  updatedAt?: string;
}
