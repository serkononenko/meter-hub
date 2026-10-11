import { SubmissionRule } from './submission-rule.js';


export interface CreateProviderAccountRequest { 
  providerId: string;
  householdId: string;
  label: string;
  accountNumber?: string;
  rule?: SubmissionRule;
}

