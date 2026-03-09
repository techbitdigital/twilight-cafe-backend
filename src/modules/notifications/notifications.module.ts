import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { Notification } from "./entities/notification.entity";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [SequelizeModule.forFeature([Notification])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // so OrdersService etc. can inject it
})
export class NotificationsModule {}
