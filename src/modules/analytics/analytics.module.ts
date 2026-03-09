import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { PeakHoursController } from "./peak-hours.controller";
import { PeakHoursService } from "./peak-hours.service";
import { CustomerAnalyticsController } from "./customer-analytics.controller";
import { CustomerAnalyticsService } from "./customer-analytics.service";
import { Order } from "../orders/entities/order.entity";
import { QRScan } from "../qrcode/entities/qr-scan.entity";
import { OrderItem } from "../orders/entities/order-item.entity";
import { MenuItem } from "../menu/entities/menu-item.entity";
@Module({
  imports: [SequelizeModule.forFeature([Order, QRScan, OrderItem, MenuItem])],
  controllers: [
    AnalyticsController,
    PeakHoursController,
    CustomerAnalyticsController,
  ],
  providers: [AnalyticsService, PeakHoursService, CustomerAnalyticsService],
  exports: [AnalyticsService, PeakHoursService, CustomerAnalyticsService],
})
export class AnalyticsModule {}
