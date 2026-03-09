/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Notification, NotificationType } from "./entities/notification.entity";

export interface NotificationResult {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

export interface NotificationSummary {
  notifications: NotificationResult[];
  unreadCount: number;
  total: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification)
    private readonly notificationModel: typeof Notification,
  ) {}

  // ── Called internally by other services (orders, menu, etc.) ──────────────
  async create(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await this.notificationModel.create({
      userId,
      type,
      title,
      message,
      meta: meta ?? null,
      isRead: false,
    });
  }

  // ── Get all for a user ─────────────────────────────────────────────────────
  async getAll(
    userId: number,
    filter: "all" | "unread" = "all",
  ): Promise<NotificationSummary> {
    const where: Record<string, unknown> = { userId };
    if (filter === "unread") where.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
      this.notificationModel.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: 50,
      }),
      this.notificationModel.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications: notifications.map((n) => this.toResult(n)),
      unreadCount,
      total: notifications.length,
    };
  }

  // ── Mark one as read ───────────────────────────────────────────────────────
  async markAsRead(userId: number, id: string): Promise<{ message: string }> {
    const notification = await this.notificationModel.findOne({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException("Notification not found");
    await notification.update({ isRead: true });
    return { message: "Marked as read" };
  }

  // ── Mark all as read ───────────────────────────────────────────────────────
  async markAllAsRead(
    userId: number,
  ): Promise<{ message: string; updated: number }> {
    const [updated] = await this.notificationModel.update(
      { isRead: true },
      { where: { userId, isRead: false } },
    );
    return { message: "All notifications marked as read", updated };
  }

  // ── Delete one ─────────────────────────────────────────────────────────────
  async deleteOne(userId: number, id: string): Promise<{ message: string }> {
    const notification = await this.notificationModel.findOne({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException("Notification not found");
    await notification.destroy();
    return { message: "Notification deleted" };
  }

  // ── Clear all read ─────────────────────────────────────────────────────────
  async clearRead(
    userId: number,
  ): Promise<{ message: string; deleted: number }> {
    const deleted = await this.notificationModel.destroy({
      where: { userId, isRead: true },
    });
    return { message: "Read notifications cleared", deleted };
  }

  // ── Private ────────────────────────────────────────────────────────────────
  private toResult(n: Notification): NotificationResult {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      meta: n.meta,
      createdAt: n.createdAt,
    };
  }
}
