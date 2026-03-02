import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,  // ← added
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';

import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { User } from '../../users/user.model';

interface OrderFilters {
  status?: string;
  search?: string;
  timeFilter?: 'last-hour';
  sort?: 'oldest' | 'newest';
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order) private readonly orderModel: typeof Order,
    @InjectModel(OrderItem) private readonly orderItemModel: typeof OrderItem,
    @InjectModel(MenuItem) private readonly menuItemModel: typeof MenuItem,
  ) {}

  /* ============================
      CREATE ORDER
  ============================ */
  async createOrder(user: User, dto: CreateOrderDto): Promise<Order> {
    const orderNumber = `ORD-${Date.now()}`;

    const menuItems = await this.menuItemModel.findAll({
      where: {
        id: dto.items.map((i) => i.menuItemId),
        status: 'published',
        isAvailableForOrdering: true,
      },
    });

    if (menuItems.length !== dto.items.length) {
      throw new BadRequestException('One or more items are unavailable');
    }

    let subtotal = 0;

    const orderItemsData = dto.items.map((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;

      if (menuItem.trackInventory && menuItem.stockQuantity < item.quantity) {
        throw new BadRequestException(`${menuItem.name} is out of stock`);
      }

      const price = Number(menuItem.salePrice ?? menuItem.regularPrice);
      subtotal += price * item.quantity;

      return {
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        price,
        quantity: item.quantity,
        selectedAddons: [],
        selectedVariation: null,
      };
    });

    const tax = Number((subtotal * 0.05).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    const order = await this.orderModel.create({
      orderNumber,
      userId: user.id,
      customerName: user.fullName ?? 'Customer',
      customerPhone: user.phone ?? '',
      deliveryInfoSnapshot: user.deliveryInfo ?? null,
      subtotal,
      tax,
      total,
      specialInstructions: dto.specialInstructions ?? null,
      status: 'pending_payment',
    });

    await this.orderItemModel.bulkCreate(
      orderItemsData.map((item) => ({ ...item, orderId: order.id })),
    );

    return this.getOrder(order.id);
  }

  /* ============================
      GET SINGLE ORDER (Internal)
  ============================ */
  async getOrder(id: string): Promise<Order> {
    const order = await this.orderModel.findByPk(id, {
      include: [OrderItem],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /* ============================
      GET ORDER WITH ACCESS CONTROL
  ============================ */
  async getOrderWithAccess(id: string, user: User): Promise<Order> {
    const order = await this.orderModel.findByPk(id, {
      include: [OrderItem],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Customers can only view their own orders
    if (user.role === 'customer' && order.userId !== user.id) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /* ============================
      GET ALL ORDERS (Admin only)
  ============================ */
  async getAllOrders(filters: OrderFilters = {}) {
    const where: WhereOptions = {};

    if (filters.status) where.status = filters.status;

    if (filters.search) {
      Object.assign(where, {
        [Op.or]: [
          { orderNumber: { [Op.like]: `%${filters.search}%` } },
          { customerName: { [Op.like]: `%${filters.search}%` } },
          { customerPhone: { [Op.like]: `%${filters.search}%` } },
        ],
      });
    }

    if (filters.timeFilter === 'last-hour') {
      where.createdAt = { [Op.gte]: new Date(Date.now() - 3600000) };
    }

    const orderDir = filters.sort === 'oldest' ? 'ASC' : 'DESC';

    return this.orderModel.findAll({
      where,
      include: [OrderItem],
      order: [['createdAt', orderDir]],
    });
  }

  /* ============================
      REJECT ORDER
  ============================ */
  async rejectOrder(id: string, reason?: string): Promise<Order> {
    const order = await this.orderModel.findByPk(id);
    if (!order) throw new NotFoundException('Order not found');

    const rejectableStatuses = ['pending_payment', 'paid'];
    if (!rejectableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be rejected. Current status: ${order.status}`,
      );
    }

    await order.update({
      status: 'cancelled',
      rejectionReason: reason ?? null,
      cancelledAt: new Date(),
    });

    return this.getOrder(id);
  }

  /* ============================
      GET CUSTOMER ORDERS
  ============================ */
  async getCustomerOrders(userId: number, filters: OrderFilters = {}) {
    const where: WhereOptions = { userId };

    if (filters.status) where.status = filters.status;

    if (filters.search) {
      Object.assign(where, {
        [Op.or]: [{ orderNumber: { [Op.like]: `%${filters.search}%` } }],
      });
    }

    if (filters.timeFilter === 'last-hour') {
      where.createdAt = { [Op.gte]: new Date(Date.now() - 3600000) };
    }

    const orderDir = filters.sort === 'oldest' ? 'ASC' : 'DESC';

    return this.orderModel.findAll({
      where,
      include: [OrderItem],
      order: [['createdAt', orderDir]],
    });
  }

  /* ============================
      UPDATE ORDER STATUS ← FIXED
  ============================ */
  async updateOrderStatus(
    id: string,
    status: string,
    user?: User,           // ← optional user for access control
  ): Promise<Order> {
    const order = await this.orderModel.findByPk(id);
    if (!order) throw new NotFoundException('Order not found');

    // ── Customer restrictions ──────────────────────────────────────────────
    if (user?.role === 'customer') {
      // Customers can only update their own orders
      if (order.userId !== user.id) {
        throw new ForbiddenException('You can only update your own orders');
      }
      // Customers can only set status to 'paid' (payment confirmation)
      if (status !== 'paid') {
        throw new ForbiddenException(
          'Customers can only confirm payment status',
        );
      }
      // Can only mark as paid if currently pending_payment
      if (order.status !== 'pending_payment') {
        throw new BadRequestException(
          `Order is already ${order.status}`,
        );
      }
    }

    await order.update({
      status,
      completedAt: status === 'completed' ? new Date() : order.completedAt,
    });

    return this.getOrder(id);
  }

  /* ============================
      ORDER STATS
  ============================ */
  async getOrderStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [newOrders, preparing, ready, completedToday] = await Promise.all([
      this.orderModel.count({ where: { status: 'new' } }),
      this.orderModel.count({ where: { status: 'preparing' } }),
      this.orderModel.count({ where: { status: 'ready' } }),
      this.orderModel.count({
        where: {
          status: 'completed',
          completedAt: { [Op.gte]: today },
        },
      }),
    ]);

    return { newOrders, preparing, ready, completedToday };
  }

  /* ============================
      GET ORDERS BY STATUS
  ============================ */
  async getOrdersByStatus(status: string) {
    return this.orderModel.findAll({
      where: { status },
      include: [OrderItem],
      order: [['createdAt', 'DESC']],
    });
  }
}