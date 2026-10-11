import type {SubmissionWindow as WindowDto} from '../generated/provider/models/index.js';
import type {SubmissionWindow} from '../submission-window/submission-rule.js';


export function toWindowDto(window: SubmissionWindow, accountId: string, providerId: string): WindowDto {
    return {
        opensAt: window.opensAt.toISOString(),
        closesAt: window.closesAt.toISOString(),
        accountId,
        providerId,
    };
}
