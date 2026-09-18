import {REQUEST_USER} from "./auth.constants.js";

import type {Request} from "express";


export interface AuthenticatedUser {
    userId: string;
}

export interface AuthenticatedRequest extends Request {
    [REQUEST_USER]?: AuthenticatedUser;
}