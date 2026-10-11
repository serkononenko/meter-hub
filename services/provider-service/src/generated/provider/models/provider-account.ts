import { SubmissionRule } from './submission-rule.js';


export interface ProviderAccount { 
  id: string;
  providerId: string;
  householdId: string;
  label: string;
  accountNumber?: string | null;
  rule: SubmissionRule;
  /**
   * Incremented on every change to the account (label, number, rule, provider, archiving), so a consumer can discard a snapshot that is not newer than the one it holds.
   */
  version: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

