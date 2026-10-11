

export interface SubmissionWindow { 
  opensAt: string;
  /**
   * Exclusive upper bound — the instant after the last moment readings are accepted.
   */
  closesAt: string;
  accountId: string;
  providerId: string;
}

