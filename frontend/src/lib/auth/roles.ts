import {SystemRole} from "@/lib/api/generated/identity-service/model";
import type {User} from "@/lib/api/generated/identity-service/model";

export function isAdmin(user: Pick<User, "roles"> | null | undefined): boolean {
  return user?.roles.includes(SystemRole.ADMIN) ?? false;
}
