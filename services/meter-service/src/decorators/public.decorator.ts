import {SetMetadata} from '@nestjs/common';
import {IS_PUBLIC} from '../auth/auth.constants.js';


export const Public = () => SetMetadata(IS_PUBLIC, true);
