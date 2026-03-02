/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  // -------------------------
  // Create admin (one-time setup)
  // -------------------------
  @Post('create-admin')
  async createAdmin(
    @Body() body: { email: string; password: string },
  ): Promise<{
    message: string;
    admin: { id: number; email: string; role: 'admin' };
  }> {
    const { email, password } = body;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    // Check if admin already exists
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new BadRequestException('Admin already exists');
    }

    const admin = await this.usersService.createAdmin(email, password);

    return {
      message: 'Admin created successfully',
      admin: {
        id: admin.id,
        email: admin.email,
        role: 'admin',
      },
    };
  }

  // -------------------------
  // Set password (for first-time users)
  // -------------------------
  @Post('set-password')
  async setPassword(
    @Body() body: { userId: number; password: string },
  ): Promise<{ message: string }> {
    const { userId, password } = body;

    if (!userId || !password) {
      throw new BadRequestException('User ID and password are required');
    }

    await this.authService.setPassword(userId, password);

    return { message: 'Password set successfully' };
  }

  // -------------------------
  // Admin login
  // -------------------------
  @Post('admin-login')
  async adminLogin(@Body() body: { email: string; password: string }): Promise<{
    access_token: string;
    user: { id: number; email: string; role: string };
  }> {
    const { email, password } = body;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    return this.authService.adminLogin(email, password);
  }

  //customer login
  @Post('login')
  async loginCustomer(@Body() body: { email: string; password: string }) {
    return this.authService.customerLogin(body.email, body.password);
  }
}
