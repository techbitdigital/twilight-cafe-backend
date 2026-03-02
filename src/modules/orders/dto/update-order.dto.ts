import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsEnum([
    'pending_payment',
    'paid',
    'preparing',
    'ready',
    'completed',
    'cancelled',
  ])
  @IsNotEmpty()
  status:
    | 'pending_payment'
    | 'paid'
    | 'preparing'
    | 'ready'
    | 'completed'
    | 'cancelled';
}
