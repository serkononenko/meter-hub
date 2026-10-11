

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
  /**
   * 1 when the meter is bound, incremented when the binding is ended.
   */
  version: number;
  createdAt: string;
  updatedAt: string;
}

