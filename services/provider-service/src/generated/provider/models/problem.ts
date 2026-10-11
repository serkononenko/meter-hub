import { ProblemErrorsInner } from './problem-errors-inner.js';


export interface Problem { 
  /**
   * URI identifying the problem type.
   */
  type: string;
  /**
   * Short, human-readable summary of the problem type.
   */
  title: string;
  status: number;
  /**
   * Stable application-specific error code.
   */
  code: string;
  /**
   * Human-readable explanation of this occurrence of the problem.
   */
  detail: string;
  /**
   * URI reference identifying the specific occurrence of the problem.
   */
  instance?: string;
  /**
   * Correlation ID associated with the request.
   */
  correlationId: string;
  /**
   * Optional field-level validation errors.
   */
  errors?: Array<ProblemErrorsInner>;
}

