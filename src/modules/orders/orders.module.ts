import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
// import { WhatsAppNotificationService } from '../whatsapp/whatsapp-notification.service';
import { QRCodeModule } from '../qrcode/qrcode.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Order, OrderItem, MenuItem]),
    QRCodeModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
