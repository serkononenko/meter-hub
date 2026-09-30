/**
 * Human-readable labels for household membership roles. Values mirror the
 * generated household-service models.
 */
import type {HouseholdRole} from "@/lib/api/generated/household-service/model";

export const householdRoleLabels: Record<HouseholdRole, string> = {
  OWNER: "Owner",
  MEMBER: "Member",
  VIEWER: "Viewer",
};
