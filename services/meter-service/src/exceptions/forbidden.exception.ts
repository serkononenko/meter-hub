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
