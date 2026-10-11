import {ForbiddenException} from "@nestjs/common";


export class ForbiddenRoleException extends ForbiddenException {
    constructor(role: string, action: string) {
        super({
            code: 'FORBIDDEN_ROLE',
            title: 'Forbidden for role',
            detail: `The ${role} role does not allow ${action}.`,
        });
    }
}

export class ForbiddenSystemRoleException extends ForbiddenException {
    constructor() {
        super({
            code: 'FORBIDDEN_SYSTEM_ROLE',
            title: 'Forbidden for system role',
            detail: 'Managing the global provider catalog requires the ADMIN system role.',
        });
    }
}
