import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { QRCode } from '../qrcode/entities/qrcode.entity';
import { QRScan } from '../qrcode/entities/qr-scan.entity';

@Module({
  imports: [
    SequelizeModule.forFeature([Order, OrderItem, MenuItem, QRCode, QRScan]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
