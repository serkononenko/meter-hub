import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC } from './auth.constants.js';

/** Marks an endpoint as not requiring authentication (health checks). */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC, true) as MethodDecorator & ClassDecorator;
