/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { DeliveryInfo } from "./user.model";
import { GetUser } from "../common/decorators/get-user.decorator";
import { UpdateUserDto } from "./dto/update-user.dto";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { GetUsersQueryDto } from "./dto/get-users-query.dto";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";

// Add this interface at the top of the file (or in a shared dto file)
interface CreateCustomerResponse {
  message: string;
  user: {
    id: number;
    email: string;
    fullName: string;
    phone: string;
    role: "customer" | "admin";
    hasPassword: boolean;
    deliveryInfo: any | null;
  } | null;
}

@Controller("users")
export class UsersController {
  constructor(private usersService: UsersService) {}

  // ─── GET /users (admin — all users with filters) ───────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllUsers(@Query() query: GetUsersQueryDto) {
    return this.usersService.getAllUsers(query);
  }

  // ─── GET /users/stats (admin — dashboard stats) ────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get("stats")
  async getUserStats() {
    return this.usersService.getUserStats();
  }

  // ─── GET /users/delivery-info (self) ──────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get("delivery-info")
  async getDeliveryInfo(@GetUser("id") userId: number) {
    return this.usersService.getDeliveryInfo(userId);
  }

  // ─── PATCH /users/delivery-info (self) ────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch("delivery-info")
  async updateDeliveryInfo(
    @GetUser("id") userId: number,
    @Body() deliveryInfo: DeliveryInfo,
  ) {
    return this.usersService.updateDeliveryInfo(userId, deliveryInfo);
  }

  // ─── PATCH /users/me (self) ────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch("me")
  async updateMe(
    @GetUser("id") userId: number,
    @Body() dto: UpdateUserDto,
  ): Promise<{ message: string; user: UserResponseDto }> {
    const updatedUser = await this.usersService.updateUser(userId, dto);
    return {
      message: "User updated successfully",
      user: {
        id: updatedUser.id,
        hasPassword: updatedUser.hasPassword,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        phone: updatedUser.phone,
        role: updatedUser.role,
        deliveryInfo: updatedUser.deliveryInfo ?? null,
      },
    };
  }

  // ─── POST /users/create-customer ──────────────────────────────────────────
  @Post("create-customer")
  async createCustomer(
    @Body() dto: CreateCustomerDto,
  ): Promise<CreateCustomerResponse> {
    // 👈 explicit return type
    const result = await this.usersService.createCustomer(dto);

    if (!result.success || !result.user) {
      return { message: result.message, user: null };
    }

    const user = result.user;

    return {
      message: result.message,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName ?? "",
        phone: user.phone ?? "",
        role: user.role,
        hasPassword: user.hasPassword,
        deliveryInfo: user.deliveryInfo ?? null,
      },
    };
  }

  // ─── GET /users/email/:email ───────────────────────────────────────────────
  @Get("email/:email")
  async findByEmail(@Param("email") email: string) {
    return this.usersService.findByEmail(email);
  }

  // ─── GET /users/:id/with-orders (admin) ───────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get(":id/with-orders")
  async getUserWithOrders(@Param("id") id: string) {
    return this.usersService.getUserWithOrders(Number(id));
  }

  // ─── GET /users/:id ────────────────────────────────────────────────────────
  @Get(":id")
  async findById(@Param("id") id: string) {
    return this.usersService.findById(Number(id));
  }

  // ─── PATCH /users/:id/admin (admin update) ─────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(":id/admin")
  async adminUpdateUser(
    @Param("id") id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.usersService.adminUpdateUser(Number(id), dto);
  }

  // ─── DELETE /users/:id (admin) ─────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async deleteUser(@Param("id") id: string) {
    return this.usersService.deleteUser(Number(id));
  }
}
