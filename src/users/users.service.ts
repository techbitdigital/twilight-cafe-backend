import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, WhereOptions } from "sequelize";
import * as bcrypt from "bcrypt";
import { User, DeliveryInfo } from "./user.model";
import { Order } from "../modules/orders/entities/order.entity";
import { OrderItem } from "../modules/orders/entities/order-item.entity";
import { UpdateUserDto } from "./dto/update-user.dto";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { GetUsersQueryDto } from "./dto/get-users-query.dto";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  // ─── Find by email ──────────────────────────────────────────────────────────
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ where: { email } });
  }

  // ─── Find by ID ─────────────────────────────────────────────────────────────
  async findById(id: number): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  // ─── Get all users (admin) ──────────────────────────────────────────────────
  async getAllUsers(query: GetUsersQueryDto) {
    const where: WhereOptions = {};

    if (query.role) where.role = query.role;

    if (query.search) {
      Object.assign(where, {
        [Op.or]: [
          { fullName: { [Op.like]: `%${query.search}%` } },
          { email: { [Op.like]: `%${query.search}%` } },
          { phone: { [Op.like]: `%${query.search}%` } },
        ],
      });
    }

    const orderDir = query.sort === "oldest" ? "ASC" : "DESC";

    const users = await this.userModel.findAll({
      where,
      include: [
        {
          model: Order,
          attributes: ["id", "total", "status", "createdAt"],
          required: false,
        },
      ],
      order: [["createdAt", orderDir]],
      attributes: { exclude: ["password"] },
    });

    return users;
  }

  // ─── User stats (admin) ─────────────────────────────────────────────────────
  async getUserStats() {
    const now = new Date();

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const monthAgo = new Date(now);
    monthAgo.setDate(1);
    monthAgo.setHours(0, 0, 0, 0);

    const [total, customers, admins, newThisWeek, newThisMonth] =
      await Promise.all([
        this.userModel.count(),
        this.userModel.count({ where: { role: "customer" } }),
        this.userModel.count({ where: { role: "admin" } }),
        this.userModel.count({
          where: { createdAt: { [Op.gte]: weekAgo } },
        }),
        this.userModel.count({
          where: { createdAt: { [Op.gte]: monthAgo } },
        }),
      ]);

    return { total, customers, admins, newThisWeek, newThisMonth };
  }

  // ─── Get user with full order history ───────────────────────────────────────
  async getUserWithOrders(id: number) {
    const user = await this.userModel.findByPk(id, {
      include: [
        {
          model: Order,
          include: [OrderItem],
          order: [["createdAt", "DESC"]],
        },
      ],
      attributes: { exclude: ["password"] },
    });

    if (!user) throw new NotFoundException("User not found");

    const orders = user.orders ?? [];
    const completedOrders = orders.filter((o) => o.status === "completed");
    const totalSpent = completedOrders.reduce(
      (sum, o) => sum + Number(o.total ?? 0),
      0,
    );

    return {
      user,
      stats: {
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        totalSpent,
        avgOrderValue:
          completedOrders.length > 0 ? totalSpent / completedOrders.length : 0,
      },
    };
  }

  // ─── Admin update user ──────────────────────────────────────────────────────
  async adminUpdateUser(id: number, dto: AdminUpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    await user.update(dto);
    return user.reload({ attributes: { exclude: ["password"] } });
  }

  // ─── Delete user ─────────────────────────────────────────────────────────────
  async deleteUser(id: number): Promise<{ message: string }> {
    const user = await this.findById(id);
    await user.destroy();
    return { message: "User deleted successfully" };
  }

  // ─── Create customer ────────────────────────────────────────────────────────
  async createCustomer(data: CreateCustomerDto) {
    const existingUser = await this.userModel.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      return {
        success: false,
        message: "User with this email already exists",
        user: null,
      };
    }

    const hashedPassword = data.password
      ? await bcrypt.hash(data.password, 10)
      : undefined;

    const user = await this.userModel.create({
      email: data.email,
      fullName: data.fullName ?? "",
      phone: data.phone ?? "",
      password: hashedPassword,
      role: "customer",
      hasPassword: !!data.password,
      deliveryInfo: data.deliveryInfo ?? undefined,
    });

    return { success: true, message: "Customer created successfully", user };
  }

  // ─── Create admin ────────────────────────────────────────────────────────────
  async createAdmin(email: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.userModel.create({
      email,
      password: hashedPassword,
      role: "admin",
      hasPassword: true,
    });
  }

  // ─── Update user (self) ──────────────────────────────────────────────────────
  async updateUser(userId: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(userId);
    await user.update(dto);
    return user;
  }

  // ─── Delivery info ───────────────────────────────────────────────────────────
  async updateDeliveryInfo(userId: number, deliveryInfo: DeliveryInfo) {
    const user = await this.findById(userId);
    user.deliveryInfo = deliveryInfo;
    await user.save();
    return user.deliveryInfo;
  }

  async getDeliveryInfo(userId: number): Promise<DeliveryInfo | null> {
    const user = await this.findById(userId);
    return user.deliveryInfo || null;
  }
}
