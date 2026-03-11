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

  // ✅ FIX: "read-all" MUST come BEFORE ":id/read"
  // NestJS matches routes top-to-bottom. If ":id/read" is declared first,
  // a request to PUT /api/notifications/read-all would match it with id="read-all"
  // and fire the wrong handler entirely.
  // PUT /api/notifications/read-all
  @Put("read-all")
  markAllAsRead(@Request() req): Promise<{ message: string; updated: number }> {
    return this.notificationsService.markAllAsRead(Number(req.user.id));
  }

  // PUT /api/notifications/:id/read
  @Put(":id/read")
  markAsRead(
    @Request() req,
    @Param("id") id: string,
  ): Promise<{ message: string }> {
    return this.notificationsService.markAsRead(Number(req.user.id), id);
  }

  // ✅ FIX: "clear-read" MUST come BEFORE ":id"
  // Same problem — if DELETE /:id is declared first, a request to
  // DELETE /api/notifications/clear-read would treat "clear-read" as an id param.
  // DELETE /api/notifications/clear-read
  @Delete("clear-read")
  clearRead(@Request() req): Promise<{ message: string; deleted: number }> {
    return this.notificationsService.clearRead(Number(req.user.id));
  }

  // DELETE /api/notifications/:id
  @Delete(":id")
  deleteOne(
    @Request() req,
    @Param("id") id: string,
  ): Promise<{ message: string }> {
    return this.notificationsService.deleteOne(Number(req.user.id), id);
  }
}
