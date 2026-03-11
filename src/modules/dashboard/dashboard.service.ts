/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Order } from "../orders/entities/order.entity";
import { OrderItem } from "../orders/entities/order-item.entity";
import { MenuItem } from "../menu/entities/menu-item.entity";
import { QRCode } from "../qrcode/entities/qrcode.entity";
import { QRScan } from "../qrcode/entities/qr-scan.entity";
import { Op, fn, col, Sequelize } from "sequelize";

export enum OrderStatus {
  PENDING_PAYMENT = "pending_payment",
  PAID = "paid",
  PREPARING = "preparing",
  READY = "ready",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export interface DashboardStats {
  ordersToday: number;
  revenueToday: number;
  totalMenuItems: number;
  avgOrderValue: number;
  pendingOrders: number;
  activeOrders: number;
}

export interface TopSellingItemAggregate {
  menuItemId: string;
  itemName: string;
  totalQuantity: number;
  totalRevenue: number;
  avgPrice: number;
}

export interface TopSellingItem extends TopSellingItemAggregate {
  image: string | null;
  category?: string;
}

export interface SystemStatus {
  whatsappConnection: "Active" | "Inactive";
  lastMenuSync: Date | null;
  qrScansToday: number;
  activeOrders: number;
}

export interface RevenueByDay {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface OrderBreakdown {
  status: string;
  count: number;
  totalValue: number;
}

const REVENUE_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.COMPLETED,
];

const ACTIVE_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(Order)
    private readonly orderModel: typeof Order,

    @InjectModel(OrderItem)
    private readonly orderItemModel: typeof OrderItem,

    @InjectModel(MenuItem)
    private readonly menuItemModel: typeof MenuItem,

    @InjectModel(QRCode)
    private readonly qrCodeModel: typeof QRCode,

    @InjectModel(QRScan)
    private readonly qrScanModel: typeof QRScan,
  ) {}

  private getTodayStart(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private toNumber(value: unknown, fallback = 0): number {
    if (value === null || value === undefined) return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }

  // -------------------------------
  // DASHBOARD STATS
  // -------------------------------
  // ✅ userId param removed — this is an admin dashboard; orders belong to
  //    customers, not the admin. Filtering by admin's userId returned 0 always.
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const today = this.getTodayStart();

      const [
        ordersToday,
        rawRevenueToday,
        totalMenuItems,
        completedOrdersToday,
        pendingOrders,
        activeOrders,
      ] = await Promise.all([
        // ✅ All orders today across all customers
        this.orderModel.count({
          where: {
            createdAt: { [Op.gte]: today },
          },
        }),

        // ✅ Revenue across all customers today
        this.orderModel.sum("total", {
          where: {
            createdAt: { [Op.gte]: today },
            status: { [Op.in]: REVENUE_STATUSES },
          },
        }),

        // All published menu items (no userId — MenuItem has no userId column)
        this.menuItemModel.count({
          where: { status: "published" },
        }),

        // ✅ All completed orders today across all customers
        this.orderModel.findAll({
          where: {
            createdAt: { [Op.gte]: today },
            status: OrderStatus.COMPLETED,
          },
          attributes: ["total"],
          raw: true,
        }),

        // ✅ All pending payment orders today
        this.orderModel.count({
          where: {
            status: OrderStatus.PENDING_PAYMENT,
            createdAt: { [Op.gte]: today },
          },
        }),

        // ✅ All active orders today
        this.orderModel.count({
          where: {
            status: { [Op.in]: ACTIVE_STATUSES },
            createdAt: { [Op.gte]: today },
          },
        }),
      ]);

      const revenueToday = this.toNumber(rawRevenueToday);

      const avgOrderValue =
        completedOrdersToday.length > 0
          ? completedOrdersToday.reduce(
              (sum, order) => sum + this.toNumber(order.total),
              0,
            ) / completedOrdersToday.length
          : 0;

      const stats: DashboardStats = {
        ordersToday,
        revenueToday: Number(revenueToday.toFixed(2)),
        totalMenuItems,
        avgOrderValue: Number(avgOrderValue.toFixed(2)),
        pendingOrders,
        activeOrders,
      };

      this.logger.log(`Dashboard stats: ${JSON.stringify(stats)}`);
      return stats;
    } catch (error) {
      this.logger.error("Failed to get dashboard stats", error);
      throw new InternalServerErrorException(
        "Failed to retrieve dashboard statistics",
      );
    }
  }

  // -------------------------------
  // TOP SELLING ITEMS
  // -------------------------------
  // ✅ userId param removed — aggregate across ALL customer orders
  async getTopSellingItems(
    limit = 5,
    timeframe: "today" | "week" | "month" | "all" = "all",
  ): Promise<TopSellingItem[]> {
    try {
      const dateFilter = this.getDateFilter(timeframe);

      const rawItems = (await this.orderItemModel.findAll({
        attributes: [
          "menuItemId",
          "itemName",
          [fn("SUM", col("quantity")), "totalQuantity"],
          [Sequelize.literal("SUM(quantity * price)"), "totalRevenue"],
          [fn("AVG", col("price")), "avgPrice"],
        ],
        include: [
          {
            model: Order,
            as: "order",
            attributes: [],
            where: {
              // ✅ No userId filter — show top sellers across all customers
              status: { [Op.in]: REVENUE_STATUSES },
              ...(dateFilter && { createdAt: dateFilter }),
            },
          },
        ],
        group: ["menuItemId", "itemName"],
        order: [[fn("SUM", col("quantity")), "DESC"]],
        limit,
        raw: true,
      })) as unknown as Array<{
        menuItemId: string;
        itemName: string;
        totalQuantity: number;
        totalRevenue: number;
        avgPrice: number;
      }>;

      const items: TopSellingItemAggregate[] = rawItems.map((item) => ({
        menuItemId: String(item.menuItemId),
        itemName: String(item.itemName),
        totalQuantity: this.toNumber(item.totalQuantity),
        totalRevenue: this.toNumber(item.totalRevenue),
        avgPrice: this.toNumber(item.avgPrice),
      }));

      const enrichedItems: TopSellingItem[] = await Promise.all(
        items.map(async (item) => {
          const menuItem = await this.menuItemModel.findByPk(item.menuItemId, {
            include: ["category"],
          });

          return {
            ...item,
            totalRevenue: Number(item.totalRevenue.toFixed(2)),
            avgPrice: Number(item.avgPrice.toFixed(2)),
            image: menuItem?.images?.[0] ?? null,
            category: menuItem?.category?.name,
          };
        }),
      );

      this.logger.log(`Top ${limit} selling items (${timeframe})`);
      return enrichedItems;
    } catch (error) {
      this.logger.error("Failed to get top selling items", error);
      throw new InternalServerErrorException(
        "Failed to retrieve top selling items",
      );
    }
  }

  private getDateFilter(
    timeframe: "today" | "week" | "month" | "all",
  ): { [Op.gte]: Date } | null {
    const now = new Date();

    switch (timeframe) {
      case "today":
        return { [Op.gte]: this.getTodayStart() };
      case "week":
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return { [Op.gte]: weekAgo };
      case "month":
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        return { [Op.gte]: monthAgo };
      case "all":
      default:
        return null;
    }
  }

  // -------------------------------
  // RECENT ORDERS
  // -------------------------------
  // ✅ userId param removed — admin sees all customer orders
  async getRecentOrders(limit = 10, status?: OrderStatus): Promise<Order[]> {
    try {
      const where: any = {};
      if (status) where.status = status;

      const orders = await this.orderModel.findAll({
        where,
        include: [{ model: OrderItem, separate: true }],
        order: [["createdAt", "DESC"]],
        limit,
      });

      this.logger.log(`Retrieved ${orders.length} recent orders`);
      return orders;
    } catch (error) {
      this.logger.error("Failed to get recent orders", error);
      throw new InternalServerErrorException(
        "Failed to retrieve recent orders",
      );
    }
  }

  // -------------------------------
  // REVENUE ANALYTICS
  // -------------------------------
  // ✅ userId param removed — revenue across all customers
  async getRevenueByDay(days = 7): Promise<RevenueByDay[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const orders = await this.orderModel.findAll({
        where: {
          createdAt: { [Op.gte]: startDate },
          status: { [Op.in]: REVENUE_STATUSES },
        },
        attributes: [
          [fn("DATE", col("createdAt")), "date"],
          [fn("SUM", col("total")), "revenue"],
          [fn("COUNT", col("id")), "orderCount"],
        ],
        group: [fn("DATE", col("createdAt"))],
        order: [[fn("DATE", col("createdAt")), "ASC"]],
        raw: true,
      });

      return orders.map((order: any) => ({
        date: order.date,
        revenue: Number(this.toNumber(order.revenue, 0).toFixed(2)),
        orderCount: this.toNumber(order.orderCount, 0),
      }));
    } catch (error) {
      this.logger.error("Failed to get revenue by day", error);
      throw new InternalServerErrorException(
        "Failed to retrieve revenue analytics",
      );
    }
  }

  // -------------------------------
  // ORDER STATUS BREAKDOWN
  // -------------------------------
  // ✅ userId param removed — breakdown across all customers
  async getOrderStatusBreakdown(): Promise<OrderBreakdown[]> {
    try {
      const today = this.getTodayStart();

      const breakdown = await this.orderModel.findAll({
        where: {
          createdAt: { [Op.gte]: today },
        },
        attributes: [
          "status",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("total")), "totalValue"],
        ],
        group: ["status"],
        raw: true,
      });

      return breakdown.map((item: any) => ({
        status: item.status,
        count: this.toNumber(item.count),
        totalValue: Number(this.toNumber(item.totalValue).toFixed(2)),
      }));
    } catch (error) {
      this.logger.error("Failed to get order status breakdown", error);
      throw new InternalServerErrorException(
        "Failed to retrieve order breakdown",
      );
    }
  }

  // -------------------------------
  // SYSTEM STATUS
  // -------------------------------
  // ✅ userId param removed — system-wide status for admin
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const today = this.getTodayStart();

      const [qrScansToday, lastMenuSync, activeOrders] = await Promise.all([
        this.qrScanModel.count({
          where: { createdAt: { [Op.gte]: today } },
        }),

        this.menuItemModel.findOne({
          order: [["updatedAt", "DESC"]],
          attributes: ["updatedAt"],
        }),

        // ✅ All active orders across all customers
        this.orderModel.count({
          where: {
            status: { [Op.in]: ACTIVE_STATUSES },
          },
        }),
      ]);

      return {
        whatsappConnection: "Active",
        lastMenuSync: lastMenuSync?.updatedAt ?? null,
        qrScansToday,
        activeOrders,
      };
    } catch (error) {
      this.logger.error("Failed to get system status", error);
      throw new InternalServerErrorException(
        "Failed to retrieve system status",
      );
    }
  }

  // -------------------------------
  // LOW STOCK ALERTS
  // -------------------------------
  async getLowStockItems(): Promise<MenuItem[]> {
    try {
      return await this.menuItemModel.findAll({
        where: {
          trackInventory: true,
          status: "published",
          [Op.and]: [{ stockQuantity: { [Op.lte]: col("lowStockAlert") } }],
        },
        order: [["stockQuantity", "ASC"]],
      });
    } catch (error) {
      this.logger.error("Failed to get low stock items", error);
      throw new InternalServerErrorException(
        "Failed to retrieve low stock items",
      );
    }
  }
}
