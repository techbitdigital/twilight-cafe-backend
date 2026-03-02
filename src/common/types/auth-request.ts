import { Request } from 'express';
import { User } from '../../users/user.model';

export interface AuthRequest extends Request {
  user: User;
}
