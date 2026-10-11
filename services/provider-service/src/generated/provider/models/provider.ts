import { ProviderScope } from './provider-scope.js';
import { SubmissionRule } from './submission-rule.js';


export interface Provider { 
  id: string;
  scope: ProviderScope;
  /**
   * The owning household for HOUSEHOLD providers; null for GLOBAL ones.
   */
  householdId?: string | null;
  name: string;
  notes?: string | null;
  /**
   * Template copied into new accounts, never a live link. Absent when the provider suggests no window.
   */
  defaultRule?: SubmissionRule;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
export namespace Provider {
}


