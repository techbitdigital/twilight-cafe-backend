/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Put,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  SettingsService,
  ProfileResult,
  UpdateProfileResult,
  NotificationPrefs,
  MessageResult,
} from "./settings.service";
import {
  UpdateProfileDto,
  ChangePasswordDto,
  UpdateNotificationsDto,
} from "./dto/settings.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@Controller("api/settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // GET /api/settings/profile
  @Get("profile")
  getProfile(@Request() req): Promise<ProfileResult> {
    return this.settingsService.getProfile(req.user.id);
  }

  // PUT /api/settings/profile
  @Put("profile")
  updateProfile(
    @Request() req,
    @Body() dto: UpdateProfileDto,
  ): Promise<UpdateProfileResult> {
    return this.settingsService.updateProfile(req.user.id, dto);
  }

  // PUT /api/settings/password
  @Put("password")
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Request() req,
    @Body() dto: ChangePasswordDto,
  ): Promise<MessageResult> {
    return this.settingsService.changePassword(req.user.id, dto);
  }

  // GET /api/settings/notifications
  @Get("notifications")
  getNotifications(@Request() req): Promise<NotificationPrefs> {
    return this.settingsService.getNotifications(req.user.id);
  }

  // PUT /api/settings/notifications
  @Put("notifications")
  updateNotifications(
    @Request() req,
    @Body() dto: UpdateNotificationsDto,
  ): Promise<MessageResult> {
    return this.settingsService.updateNotifications(req.user.id, dto);
  }
}
