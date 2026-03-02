import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { User, DeliveryInfo } from './user.model';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  // -------------------------
  // Find user by email
  // -------------------------
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ where: { email } });
  }

  // -------------------------
  // Find user by ID
  // -------------------------
  async findById(id: number): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // -------------------------
  // Create customer
  // -------------------------
  async createCustomer(data: CreateCustomerDto) {
    // Check if a user with the same email already exists
    const existingUser = await this.userModel.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      return {
        success: false,
        message: 'User with this email already exists',
        user: null,
      };
    }

    // Hash password if provided
    const hashedPassword = data.password
      ? await bcrypt.hash(data.password, 10)
      : undefined;

    // Create the user
    const user = await this.userModel.create({
      email: data.email,
      fullName: data.fullName ?? '',
      phone: data.phone ?? '',
      password: hashedPassword,
      role: 'customer',
      hasPassword: !!data.password,
      deliveryInfo: data.deliveryInfo ?? undefined,
    });

    return {
      success: true,
      message: 'Customer created successfully',
      user,
    };
  }

  // -------------------------
  // Create admin (one-time)
  // -------------------------
  async createAdmin(email: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);

    return this.userModel.create({
      email,
      password: hashedPassword,
      role: 'admin',
      hasPassword: true,
    });
  }

  // -------------------------
  // Update user
  // -------------------------
  async updateUser(userId: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(userId);
    await user.update(dto);
    return user;
  }

  // -------------------------
  // Update delivery info
  // -------------------------
  async updateDeliveryInfo(userId: number, deliveryInfo: DeliveryInfo) {
    const user = await this.findById(userId);
    user.deliveryInfo = deliveryInfo;
    await user.save();
    return user.deliveryInfo;
  }

  // -------------------------
  // Get delivery info
  // -------------------------
  async getDeliveryInfo(userId: number): Promise<DeliveryInfo | null> {
    const user = await this.findById(userId);
    return user.deliveryInfo || null;
  }
}
