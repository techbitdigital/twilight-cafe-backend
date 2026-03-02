/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.model';
import { LoginResponse } from './dto/login-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // -------------------------
  // Validate a generic user (customer)
  // -------------------------
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.hasPassword || !user.password) {
      throw new UnauthorizedException('Password not set');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  // -------------------------
  // CUSTOMER LOGIN
  // -------------------------
  async customerLogin(email: string, password: string): Promise<LoginResponse> {
    const user = await this.usersService.findByEmail(email);

    if (!user || user.role !== 'customer') {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Password not set');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: 'customer',
        deliveryInfo: user.deliveryInfo ?? null,
      },
    };
  }

  // -------------------------
  // Set password for first-time customers/admins
  // -------------------------
  async setPassword(userId: number, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.usersService.updateUser(userId, {
      password: hashedPassword,
      hasPassword: true,
    });
  }

  // -------------------------
  // Admin login
  // -------------------------
  async adminLogin(
    email: string,
    password: string,
  ): Promise<{
    access_token: string;
    user: { id: number; email: string; role: string };
  }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role !== 'admin') {
      throw new UnauthorizedException('Not an admin');
    }

    if (!user.hasPassword || !user.password) {
      throw new UnauthorizedException('Admin password not set');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, role: user.role, email: user.email };
    const access_token = this.jwtService.sign(payload);

    // Return only the properties needed by the frontend
    return {
      access_token,
      user: {
        id: user.id, // '!' because Sequelize marks id as optional in typing
        email: user.email,
        role: user.role,
      },
    };
  }
}
