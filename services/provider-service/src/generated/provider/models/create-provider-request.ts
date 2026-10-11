import { ProviderScope } from './provider-scope.js';
import { SubmissionRule } from './submission-rule.js';


export interface CreateProviderRequest { 
  scope: ProviderScope;
  /**
   * Required for HOUSEHOLD, forbidden for GLOBAL.
   */
  householdId?: string;
  name: string;
  notes?: string;
  defaultRule?: SubmissionRule;
}
export namespace CreateProviderRequest {
}


