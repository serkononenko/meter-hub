

export interface MeterBinding { 
  id: string;
  accountId: string;
  householdId: string;
  meterId: string;
  validFrom: string;
  /**
   * Last day the binding applies; null while open-ended.
   */
  validTo?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

