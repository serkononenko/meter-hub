/**
 * Request attribute the auth guard stores the verified caller under, and the
 * `CurrentUser` param decorator reads back.
 */
export const REQUEST_USER = 'authenticatedUser';

/**
 * Metadata key marking endpoints that skip authentication (only /health —
 * orchestrators cannot present bearer tokens).
 */
export const IS_PUBLIC = 'isPublicEndpoint';
