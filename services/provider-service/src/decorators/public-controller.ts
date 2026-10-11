import {Public} from './public.decorator.js';


// The generated controllers are rewritten by api:gen, so @Public cannot be written into their source.
// It is only metadata, so it is applied from the owning module at load time instead.
export function decoratePublicController(controller: abstract new (...args: never[]) => unknown): void {
    Public()(controller as unknown as new (...args: never[]) => unknown);
}
