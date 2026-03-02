// users/users.controller.ts
import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { DeliveryInfo } from './user.model';
import { GetUser } from '../common/decorators/get-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UserResponseDto } from './dto/user-response.dto';
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('delivery-info')
  async getDeliveryInfo(@GetUser('id') userId: number) {
    return this.usersService.getDeliveryInfo(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('delivery-info')
  async updateDeliveryInfo(
    @GetUser('id') userId: number,
    @Body() deliveryInfo: DeliveryInfo,
  ) {
    return this.usersService.updateDeliveryInfo(userId, deliveryInfo);
  }

  // -------------------------
  // CREATE CUSTOMER
  // -------------------------
  @Post('create-customer')
  async createCustomer(@Body() dto: CreateCustomerDto): Promise<{
    message: string;
    user: {
      id: number;
      email: string;
      fullName: string;
      phone: string;
      role: 'customer' | 'admin';
      hasPassword: boolean;
      deliveryInfo: any;
    } | null;
  }> {
    const result = await this.usersService.createCustomer(dto);

    // If user creation failed
    if (!result.success || !result.user) {
      return {
        message: result.message,
        user: null,
      };
    }

    const user = result.user; // Now TypeScript knows user is NOT null

    return {
      message: result.message,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName ?? '',
        phone: user.phone ?? '',
        role: user.role,
        hasPassword: user.hasPassword,
        deliveryInfo: user.deliveryInfo ?? null,
      },
    };
  }

  // -------------------------
  // FIND USER BY EMAIL
  // GET /users/email/:email
  // -------------------------
  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  // -------------------------
  // FIND USER BY ID
  // GET /users/:id
  // -------------------------
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.usersService.findById(Number(id));
  }

  // -------------------------
  // UPDATE CURRENT USER
  // PATCH /users/me
  // -------------------------
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @GetUser('id') userId: number,
    @Body() dto: UpdateUserDto,
  ): Promise<{ message: string; user: UserResponseDto }> {
    const updatedUser = await this.usersService.updateUser(userId, dto);

    return {
      message: 'User updated successfully',
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
}
