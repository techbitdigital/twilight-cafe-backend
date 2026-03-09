import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import * as bcrypt from "bcrypt";
import { User } from "../../users/user.model";
import type {
  UpdateProfileDto,
  ChangePasswordDto,
  UpdateNotificationsDto,
} from "./dto/settings.dto";

// ── Return type interfaces ────────────────────────────────────────────────────

export interface ProfileResult {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: string;
}

export interface UpdateProfileResult {
  message: string;
  user: {
    id: number;
    fullName: string;
    email: string;
    phone: string;
  };
}

export interface NotificationPrefs {
  newOrders: boolean;
  lowStock: boolean;
  emailSummary: boolean;
}

export interface MessageResult {
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findUser(id: number): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: number): Promise<ProfileResult> {
    const user = await this.findUser(userId);
    return {
      id: user.id,
      fullName: user.fullName ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      role: user.role ?? "",
    };
  }

  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<UpdateProfileResult> {
    try {
      const user = await this.findUser(userId);

      if (dto.email && dto.email !== user.email) {
        const existing = await this.userModel.findOne({
          where: { email: dto.email },
        });
        if (existing) {
          throw new BadRequestException("Email is already in use");
        }
      }

      await user.update({
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      });

      await user.reload();

      return {
        message: "Profile updated successfully",
        user: {
          id: user.id,
          fullName: user.fullName ?? "",
          email: user.email ?? "",
          phone: user.phone ?? "",
        },
      };
    } catch (error) {
      this.logger.error(
        "Failed to update profile",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  // ─── Password ─────────────────────────────────────────────────────────────

  // ✅ Method signature was missing — body was floating loose in the file
  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<MessageResult> {
    try {
      if (dto.newPassword !== dto.confirmPassword) {
        throw new BadRequestException("New passwords do not match");
      }

      if (dto.newPassword === dto.currentPassword) {
        throw new BadRequestException(
          "New password must differ from current password",
        );
      }

      const user = await this.findUser(userId);

      if (!user.password) {
        throw new BadRequestException(
          "No password set on this account. Use OAuth login.",
        );
      }

      const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isMatch) {
        throw new UnauthorizedException("Current password is incorrect");
      }

      const hashed = await bcrypt.hash(dto.newPassword, 12);
      await user.update({ password: hashed });

      return { message: "Password changed successfully" };
    } catch (error) {
      this.logger.error(
        "Failed to change password",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  async getNotifications(userId: number): Promise<NotificationPrefs> {
    const user = await this.findUser(userId);
    // ✅ typed via the column added to user.model.ts — no more `as any`
    const prefs = user.notificationPrefs ?? {};
    return {
      newOrders: prefs.newOrders ?? true,
      lowStock: prefs.lowStock ?? true,
      emailSummary: prefs.emailSummary ?? false,
    };
  }

  async updateNotifications(
    userId: number,
    dto: UpdateNotificationsDto,
  ): Promise<MessageResult> {
    try {
      const user = await this.findUser(userId);
      const current = user.notificationPrefs ?? {};

      await user.update({
        notificationPrefs: { ...current, ...dto },
      });

      return { message: "Notification preferences saved" };
    } catch (error) {
      this.logger.error(
        "Failed to update notifications",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
