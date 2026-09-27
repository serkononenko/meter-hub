import {createHash} from "node:crypto";


export const getObjectHash = (payload: Object): string => {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
