import {SetMetadata} from '@nestjs/common';

/**
 * Metadata key marking endpoints that skip authentication (only /health —
 * orchestrators cannot present bearer tokens). The auth guard (6.5) reads it.
 */
export const IS_PUBLIC = 'isPublicEndpoint';

export const Public = () => SetMetadata(IS_PUBLIC, true);
