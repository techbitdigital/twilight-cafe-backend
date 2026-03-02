import { DeliveryInfo } from '../../users/user.model';
export interface LoginUserResponse {
  id: number;
  email: string;
  role: 'customer';
  deliveryInfo: DeliveryInfo | null;
}

export interface LoginResponse {
  accessToken: string;
  user: LoginUserResponse;
}
