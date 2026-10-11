import {HttpCode} from '@nestjs/common';


// The OpenAPI-generated controllers own the route handlers and are rewritten by api:gen, so a
// status override can't live in their source. HttpCode is only metadata, so it is applied from
// the owning module at load time instead.
export function decorateHttpCode(controller: abstract new (...args: never[]) => unknown, method: string, status: number): void {
    const prototype = (controller as {prototype: Record<string, unknown>}).prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, method);

    if (!descriptor) {
        throw new Error(`decorateHttpCode: ${controller.name}.${method} does not exist; did the generated controller change?`);
    }

    HttpCode(status)(prototype as object, method, descriptor);
}
