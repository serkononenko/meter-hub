import {REQUEST_USER} from "./auth.constants.js";

import type {Request} from "express";
import type {AuthenticatedUser} from '../typedef.js';


export interface AuthenticatedRequest extends Request {
    [REQUEST_USER]?: AuthenticatedUser;
}