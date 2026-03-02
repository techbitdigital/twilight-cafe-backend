import { DeliveryInfo } from '../user.model';

export class UpdateUserDto {
  fullName?: string;
  phone?: string;
  password?: string;
  deliveryInfo?: DeliveryInfo;
  hasPassword?: boolean;
}
