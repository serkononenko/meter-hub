import { SubmissionRule } from './submission-rule.js';


export interface ProviderAccount { 
  id: string;
  providerId: string;
  householdId: string;
  label: string;
  accountNumber?: string | null;
  rule: SubmissionRule;
  /**
   * Incremented on every change to the rule or provider.
   */
  version: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

