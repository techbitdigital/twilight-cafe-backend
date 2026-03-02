// src/auth/interfaces/auth-request.interface.ts
import { Request } from 'express';
import { Role } from '../../common/enums/role.enum';

export interface AuthRequest extends Request {
  user: {
    userId: number;
    role: Role;
  };
}
