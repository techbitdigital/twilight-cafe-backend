import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { User } from "../../users/user.model";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [SequelizeModule.forFeature([User])],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
