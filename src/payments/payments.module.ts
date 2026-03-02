import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaystackService } from './paystack.service';
import { OrdersModule } from '../modules/orders/orders.module';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController],
  providers: [PaystackService],
})
export class PaymentsModule {}