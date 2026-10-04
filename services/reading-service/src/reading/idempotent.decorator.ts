import {Idempotent} from '@nestjs/idempotency';

import type {Duration} from '@nestjs/idempotency';

/**
 * Attaches @Idempotent() to a handler of a generated controller. The
 * openapi-generated controllers own the route handlers and are regenerated
 * by api:gen, so the decorator can't be written into their source; but it
 * is only metadata (@nestjs/idempotency's global interceptor reads it via
 * Reflector), which can be applied from the owning feature module at load
 * time instead.
 */
export function decorateIdempotent(controller: abstract new (...args: never[]) => unknown, method: string, options: {ttl?: Duration} = {}): void {
    const prototype = (controller as {prototype: Record<string, unknown>}).prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, method);

    if (!descriptor) {
        throw new Error(`decorateIdempotent: ${controller.name}.${method} does not exist — did the generated controller change?`);
    }

    Idempotent(options)(prototype as object, method, descriptor);
}
