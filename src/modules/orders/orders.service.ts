import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, WhereOptions } from "sequelize";

import { Order } from "./entities/order.entity";
import { OrderItem } from "./entities/order-item.entity";
import { MenuItem } from "../menu/entities/menu-item.entity";
import { Variation } from "../menu/entities/variation.entity";
import { Addon } from "../menu/entities/addon.entity";
import { CreateOrderDto } from "./dto/create-order.dto";
import { User } from "../../users/user.model";
import { NotificationsService } from "../notifications/notifications.service";

interface OrderFilters {
  status?: string;
  search?: string;
  timeFilter?: "last-hour";
  sort?: "oldest" | "newest";
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order) private readonly orderModel: typeof Order,
    @InjectModel(OrderItem) private readonly orderItemModel: typeof OrderItem,
    @InjectModel(MenuItem) private readonly menuItemModel: typeof MenuItem,
    // ✅ Inject variation and addon models so we can look them up
    @InjectModel(Variation)
    private readonly variationModel: typeof Variation,
    @InjectModel(Addon)
    private readonly addonModel: typeof Addon,
    private readonly notificationsService: NotificationsService,
  ) {}

  /* ============================
      CREATE ORDER
  ============================ */
  async createOrder(user: User, dto: CreateOrderDto): Promise<Order> {
    const orderNumber = `ORD-${Date.now()}`;

    const menuItems = await this.menuItemModel.findAll({
      where: {
        id: dto.items.map((i) => i.menuItemId),
        status: "published",
        isAvailableForOrdering: true,
      },
    });

    if (menuItems.length !== dto.items.length) {
      throw new BadRequestException("One or more items are unavailable");
    }

    // ✅ STEP 1: Resolve all items FIRST
    const resolvedOrderItems = await Promise.all(
      dto.items.map(async (item) => {
        const menuItem = menuItems.find((m) => m.id === item.menuItemId);

        if (!menuItem) {
          throw new BadRequestException("Menu item not found");
        }

        if (menuItem.trackInventory && menuItem.stockQuantity < item.quantity) {
          throw new BadRequestException(`${menuItem.name} is out of stock`);
        }

        let unitPrice = Number(menuItem.salePrice ?? menuItem.regularPrice);

        // ─── Variation ─────────────────────────
        let selectedVariation: {
          id: string;
          name: string;
          priceAdjustment: string;
        } | null = null;

        if (item.variationId) {
          const variation = await this.variationModel.findOne({
            where: {
              id: item.variationId,
              menuItemId: menuItem.id,
              isAvailable: true,
            },
          });

          if (!variation) {
            throw new BadRequestException(
              `Variation not found for item ${menuItem.name}`,
            );
          }

          unitPrice += Number(variation.priceAdjustment);

          selectedVariation = {
            id: variation.id,
            name: variation.name,
            priceAdjustment: String(variation.priceAdjustment),
          };
        }

        // ─── Addons ─────────────────────────
        const selectedAddons: {
          id: string;
          name: string;
          price: string;
        }[] = [];

        if (item.addonIds?.length) {
          for (const addonId of item.addonIds) {
            const addon = await this.addonModel.findOne({
              where: {
                id: addonId,
                menuItemId: menuItem.id,
                isAvailable: true,
              },
            });

            if (!addon) {
              throw new BadRequestException(
                `Addon not found for item ${menuItem.name}`,
              );
            }

            unitPrice += Number(addon.price);

            selectedAddons.push({
              id: addon.id,
              name: addon.name,
              price: String(addon.price),
            });
          }
        }

        return {
          menuItemId: menuItem.id,
          itemName: menuItem.name,
          price: unitPrice, // ✅ FULL price per unit
          quantity: item.quantity,
          selectedVariation,
          selectedAddons,
        };
      }),
    );

    // ✅ STEP 2: Calculate subtotal AFTER resolving
    const subtotal = resolvedOrderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const tax = Number((subtotal * 0.05).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    // ✅ STEP 3: Save order
    const order = await this.orderModel.create({
      orderNumber,
      userId: user.id,
      customerName: user.fullName ?? "Customer",
      customerPhone: user.phone ?? "",
      orderType: dto.orderType ?? "pick-up",
      deliveryInfoSnapshot: dto.deliveryInfo ?? null,
      subtotal,
      tax,
      total,
      specialInstructions: dto.specialInstructions ?? null,
      status: "pending_payment",
    });

    // ✅ STEP 4: Save order items
    await this.orderItemModel.bulkCreate(
      resolvedOrderItems.map((item) => ({
        ...item,
        orderId: order.id,
      })),
    );

    await this.notificationsService.create(
      user.id,
      "order",
      "Order Placed Successfully",
      `Your order ${orderNumber} has been placed and is awaiting payment. Total: ₦${total}`,
      { orderId: order.id, orderNumber, total },
    );

    this.logger.log(`Notification sent for new order ${orderNumber}`);

    return this.getOrder(order.id);
  }

  /* ============================
      GET SINGLE ORDER (Internal)
  ============================ */
  async getOrder(id: string): Promise<Order> {
    const order = await this.orderModel.findByPk(id, {
      include: [OrderItem],
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  /* ============================
      GET ORDER WITH ACCESS CONTROL
  ============================ */
  async getOrderWithAccess(id: string, user: User): Promise<Order> {
    const order = await this.orderModel.findByPk(id, {
      include: [OrderItem],
    });

    if (!order) throw new NotFoundException("Order not found");

    if (user.role === "customer" && order.userId !== user.id) {
      throw new NotFoundException("Order not found");
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

    if (filters.timeFilter === "last-hour") {
      where.createdAt = { [Op.gte]: new Date(Date.now() - 3600000) };
    }

    const orderDir = filters.sort === "oldest" ? "ASC" : "DESC";

    return this.orderModel.findAll({
      where,
      include: [OrderItem],
      order: [["createdAt", orderDir]],
    });
  }

  /* ============================
      REJECT ORDER
  ============================ */
  async rejectOrder(id: string, reason?: string): Promise<Order> {
    const order = await this.orderModel.findByPk(id);
    if (!order) throw new NotFoundException("Order not found");

    const rejectableStatuses = ["pending_payment", "paid"];
    if (!rejectableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be rejected. Current status: ${order.status}`,
      );
    }

    await order.update({
      status: "rejected",
      rejectionReason: reason ?? null,
      cancelledAt: new Date(),
    });

    if (order.userId) {
      await this.notificationsService.create(
        order.userId,
        "order",
        "Order Rejected",
        reason
          ? `Your order ${order.orderNumber} was rejected. Reason: ${reason}`
          : `Your order ${order.orderNumber} has been rejected by the restaurant`,
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: reason ?? null,
        },
      );
    }

    this.logger.log(
      `Notification sent for rejected order ${order.orderNumber}`,
    );

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

    if (filters.timeFilter === "last-hour") {
      where.createdAt = { [Op.gte]: new Date(Date.now() - 3600000) };
    }

    const orderDir = filters.sort === "oldest" ? "ASC" : "DESC";

    return this.orderModel.findAll({
      where,
      include: [OrderItem],
      order: [["createdAt", orderDir]],
    });
  }

  /* ============================
      UPDATE ORDER STATUS
  ============================ */
  async updateOrderStatus(
    id: string,
    status: string,
    user?: User,
  ): Promise<Order> {
    const order = await this.orderModel.findByPk(id);
    if (!order) throw new NotFoundException("Order not found");

    if (user?.role === "customer") {
      if (order.userId !== user.id) {
        throw new ForbiddenException("You can only update your own orders");
      }
      if (status !== "paid") {
        throw new ForbiddenException(
          "Customers can only confirm payment status",
        );
      }
      if (order.status !== "pending_payment") {
        throw new BadRequestException(`Order is already ${order.status}`);
      }
    }

    await order.update({
      status,
      completedAt: status === "completed" ? new Date() : order.completedAt,
    });

    const statusNotifications: Record<
      string,
      { title: string; message: string }
    > = {
      paid: {
        title: "Payment Confirmed",
        message: `Payment for order ${order.orderNumber} has been confirmed. We're preparing your order now!`,
      },
      preparing: {
        title: "Order Being Prepared",
        message: `Great news! Your order ${order.orderNumber} is now being prepared by our kitchen`,
      },
      ready: {
        title: "Order Ready!",
        message: `Your order ${order.orderNumber} is ready for pickup/eat-in. Enjoy your meal!`,
      },
      completed: {
        title: "Order Completed",
        message: `Your order ${order.orderNumber} has been completed. Thank you for dining with us!`,
      },
      cancelled: {
        title: "Order Cancelled",
        message: `Your order ${order.orderNumber} has been cancelled. Contact us if you have questions`,
      },
    };

    const notif = statusNotifications[status];

    if (notif && order.userId) {
      await this.notificationsService.create(
        order.userId,
        "order",
        notif.title,
        notif.message,
        { orderId: order.id, orderNumber: order.orderNumber, status },
      );

      this.logger.log(
        `Notification sent for order ${order.orderNumber} → status: ${status}`,
      );
    }

    return this.getOrder(id);
  }

  /* ============================
      ORDER STATS
  ============================ */
  async getOrderStats(period: "today" | "week" | "month" = "today") {
    const now = new Date();
    let since: Date;

    if (period === "week") {
      since = new Date(now);
      since.setDate(now.getDate() - 7);
      since.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      since = new Date(now);
      since.setDate(1);
      since.setHours(0, 0, 0, 0);
    } else {
      since = new Date(now);
      since.setHours(0, 0, 0, 0);
    }

    const periodWhere: WhereOptions = { createdAt: { [Op.gte]: since } };

    const [newOrders, preparing, ready, completedOrders] = await Promise.all([
      this.orderModel.count({
        where: {
          status: { [Op.in]: ["pending_payment", "paid"] },
          ...periodWhere,
        },
      }),
      this.orderModel.count({
        where: { status: "preparing", ...periodWhere },
      }),
      this.orderModel.count({
        where: { status: "ready", ...periodWhere },
      }),
      this.orderModel.findAll({
        where: { status: "completed", completedAt: { [Op.gte]: since } },
        attributes: ["total"],
      }),
    ]);

    const completedToday = completedOrders.length;
    const revenue = completedOrders.reduce(
      (sum, o) => sum + Number(o.total ?? 0),
      0,
    );

    return { newOrders, preparing, ready, completedToday, revenue };
  }

  /* ============================
      GET ORDERS BY STATUS
  ============================ */
  async getOrdersByStatus(status: string) {
    return this.orderModel.findAll({
      where: { status },
      include: [OrderItem],
      order: [["createdAt", "DESC"]],
    });
  }
}
