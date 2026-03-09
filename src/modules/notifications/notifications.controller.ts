/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import type { NotificationSummary } from "./notifications.service";

@Controller("api/notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // GET /api/notifications?filter=all|unread
  @Get()
  getAll(
    @Request() req,
    @Query("filter") filter: "all" | "unread" = "all",
  ): Promise<NotificationSummary> {
    return this.notificationsService.getAll(Number(req.user.id), filter);
  }

  // PUT /api/notifications/:id/read
  @Put(":id/read")
  markAsRead(
    @Request() req,
    @Param("id") id: string,
  ): Promise<{ message: string }> {
    return this.notificationsService.markAsRead(Number(req.user.id), id);
  }

  // PUT /api/notifications/read-all
  @Put("read-all")
  markAllAsRead(@Request() req): Promise<{ message: string; updated: number }> {
    return this.notificationsService.markAllAsRead(Number(req.user.id));
  }

  // DELETE /api/notifications/:id
  @Delete(":id")
  deleteOne(
    @Request() req,
    @Param("id") id: string,
  ): Promise<{ message: string }> {
    return this.notificationsService.deleteOne(Number(req.user.id), id);
  }

  // DELETE /api/notifications/clear-read
  @Delete("clear-read")
  clearRead(@Request() req): Promise<{ message: string; deleted: number }> {
    return this.notificationsService.clearRead(Number(req.user.id));
  }
}
