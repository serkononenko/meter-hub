import { SubmissionRule } from './submission-rule.js';


export interface UpdateProviderRequest { 
  name?: string;
  notes?: string;
  defaultRule?: SubmissionRule;
  archived?: boolean;
}

