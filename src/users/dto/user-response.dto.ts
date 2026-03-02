import { DeliveryInfo } from '../user.model';

export class UserResponseDto {
  id: number;
  email: string;
  fullName?: string;
  phone?: string;
  role: 'customer' | 'admin';
  hasPassword: boolean;
  deliveryInfo?: DeliveryInfo | null;
}
