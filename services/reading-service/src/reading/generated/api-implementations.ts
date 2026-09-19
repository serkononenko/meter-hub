import { Type } from '@nestjs/common';
import { ReadingsApi } from './api/index.js';

/**
 * Provide this type to {@link ApiModule} to provide your API implementations
**/
export type ApiImplementations = {
  readingsApi: Type<ReadingsApi>
};
