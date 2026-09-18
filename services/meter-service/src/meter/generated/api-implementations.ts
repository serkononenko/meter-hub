import { Type } from '@nestjs/common';
import { MetersApi } from './api/index.js';

/**
 * Provide this type to {@link ApiModule} to provide your API implementations
**/
export type ApiImplementations = {
  metersApi: Type<MetersApi>
};
