import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { Order } from "./entities/order.entity";
import { OrderItem } from "./entities/order-item.entity";
import { MenuItem } from "../menu/entities/menu-item.entity";
import { Variation } from "../menu/entities/variation.entity";
import { Addon } from "../menu/entities/addon.entity";
// import { WhatsAppNotificationService } from '../whatsapp/whatsapp-notification.service';
import { QRCodeModule } from "../qrcode/qrcode.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    SequelizeModule.forFeature([Order, OrderItem, MenuItem, Variation, Addon]),
    QRCodeModule,
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
