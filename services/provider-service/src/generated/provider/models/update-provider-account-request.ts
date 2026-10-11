import { SubmissionRule } from './submission-rule.js';


export interface UpdateProviderAccountRequest { 
  label?: string;
  accountNumber?: string;
  rule?: SubmissionRule;
  providerId?: string;
  archived?: boolean;
}

