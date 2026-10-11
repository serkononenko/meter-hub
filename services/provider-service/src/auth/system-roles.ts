import {ForbiddenSystemRoleException} from "../exceptions/forbidden.exception.js";

import type {AuthenticatedUser} from "../typedef.js";


export const ADMIN_ROLE = 'ADMIN';

export function assertAdmin(user: AuthenticatedUser): void {
    if (!user.roles.includes(ADMIN_ROLE)) {
        throw new ForbiddenSystemRoleException();
    }
}
