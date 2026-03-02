/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { QRCode } from '../qrcode/entities/qrcode.entity';
import { QRScan } from '../qrcode/entities/qr-scan.entity';
import { Op, fn, col, Sequelize } from 'sequelize'; // ⭐ Fixed import

export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  PREPARING = 'preparing',
  READY = 'ready',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// ⭐ Export these interfaces
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
  whatsappConnection: 'Active' | 'Inactive';
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

/**
 * Status groups for different calculations
 */
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

/**
 * Dashboard service - Provides analytics and statistics
 */
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

  /**
   * Get today's date at midnight (for consistent daily queries)
   */
  private getTodayStart(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  /**
   * Safely convert Sequelize aggregate result to number
   */
  private toNumber(value: unknown, fallback = 0): number {
    if (value === null || value === undefined) return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }

  // -------------------------------
  // DASHBOARD STATS
  // -------------------------------
  /**
   * Get comprehensive dashboard statistics for today
   * Includes orders, revenue, menu items, and averages
   */
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
        // Total orders created today
        this.orderModel.count({
          where: { createdAt: { [Op.gte]: today } },
        }),

        // Revenue from paid/completed orders today
        this.orderModel.sum('total', {
          where: {
            createdAt: { [Op.gte]: today },
            status: { [Op.in]: REVENUE_STATUSES },
          },
        }),

        // Published menu items
        this.menuItemModel.count({
          where: { status: 'published' },
        }),

        // Completed orders for average calculation
        this.orderModel.findAll({
          where: {
            createdAt: { [Op.gte]: today },
            status: OrderStatus.COMPLETED,
          },
          attributes: ['total'],
          raw: true,
        }),

        // Orders waiting for payment
        this.orderModel.count({
          where: {
            status: OrderStatus.PENDING_PAYMENT,
            createdAt: { [Op.gte]: today },
          },
        }),

        // Orders currently being processed
        this.orderModel.count({
          where: {
            status: { [Op.in]: ACTIVE_STATUSES },
            createdAt: { [Op.gte]: today },
          },
        }),
      ]);

      // Safe revenue calculation
      const revenueToday = this.toNumber(rawRevenueToday);

      // Calculate average order value from completed orders
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

      this.logger.log(`Dashboard stats calculated: ${JSON.stringify(stats)}`);
      return stats;
    } catch (error) {
      this.logger.error('Failed to get dashboard stats', error);
      throw new InternalServerErrorException(
        'Failed to retrieve dashboard statistics',
      );
    }
  }

  // -------------------------------
  // TOP SELLING ITEMS
  // -------------------------------
  /**
   * Get top selling menu items based on total quantity sold
   * @param limit - Number of items to return (default: 5)
   * @param timeframe - Optional timeframe ('today', 'week', 'month', 'all')
   */
  async getTopSellingItems(
    limit = 5,
    timeframe: 'today' | 'week' | 'month' | 'all' = 'all',
  ): Promise<TopSellingItem[]> {
    try {
      // Calculate date range based on timeframe
      const dateFilter = this.getDateFilter(timeframe);

      const rawItems = (await this.orderItemModel.findAll({
        attributes: [
          'menuItemId',
          'itemName',
          [fn('SUM', col('quantity')), 'totalQuantity'],
          // ⭐ FIX: Use Sequelize.literal for multiplication
          [Sequelize.literal('SUM(quantity * price)'), 'totalRevenue'],
          [fn('AVG', col('price')), 'avgPrice'],
        ],
        include: [
          {
            model: Order,
            as: 'order',
            attributes: [],
            where: {
              status: { [Op.in]: REVENUE_STATUSES },
              ...(dateFilter && { createdAt: dateFilter }),
            },
          },
        ],
        group: ['menuItemId', 'itemName'],
        order: [[fn('SUM', col('quantity')), 'DESC']],
        limit,
        raw: true,
      })) as unknown as Array<{
        menuItemId: string;
        itemName: string;
        totalQuantity: number;
        totalRevenue: number;
        avgPrice: number;
      }>;

      // Type-safe mapping
      const items: TopSellingItemAggregate[] = rawItems.map((item) => ({
        menuItemId: String(item.menuItemId),
        itemName: String(item.itemName),
        totalQuantity: this.toNumber(item.totalQuantity),
        totalRevenue: this.toNumber(item.totalRevenue),
        avgPrice: this.toNumber(item.avgPrice),
      }));

      // Enrich with menu item details
      const enrichedItems: TopSellingItem[] = await Promise.all(
        items.map(async (item) => {
          const menuItem = await this.menuItemModel.findByPk(item.menuItemId, {
            include: ['category'],
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

      this.logger.log(`Top ${limit} selling items retrieved for ${timeframe}`);
      return enrichedItems;
    } catch (error) {
      this.logger.error('Failed to get top selling items', error);
      throw new InternalServerErrorException(
        'Failed to retrieve top selling items',
      );
    }
  }

  /**
   * Helper to get date filter based on timeframe
   */
  private getDateFilter(
    timeframe: 'today' | 'week' | 'month' | 'all',
  ): { [Op.gte]: Date } | null {
    const now = new Date();

    switch (timeframe) {
      case 'today':
        return { [Op.gte]: this.getTodayStart() };

      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return { [Op.gte]: weekAgo };

      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        return { [Op.gte]: monthAgo };

      case 'all':
      default:
        return null;
    }
  }

  // -------------------------------
  // RECENT ORDERS
  // -------------------------------
  /**
   * Get recent orders with their items
   * @param limit - Number of orders to return (default: 10)
   * @param status - Optional status filter
   */
  async getRecentOrders(limit = 10, status?: OrderStatus): Promise<Order[]> {
    try {
      const where: any = {};
      if (status) {
        where.status = status;
      }

      const orders = await this.orderModel.findAll({
        where,
        include: [
          {
            model: OrderItem,
            separate: true, // Prevents N+1 query issues
          },
        ],
        order: [['createdAt', 'DESC']],
        limit,
      });

      this.logger.log(`Retrieved ${orders.length} recent orders`);
      return orders;
    } catch (error) {
      this.logger.error('Failed to get recent orders', error);
      throw new InternalServerErrorException(
        'Failed to retrieve recent orders',
      );
    }
  }

  // -------------------------------
  // REVENUE ANALYTICS
  // -------------------------------
  /**
   * Get revenue breakdown by day for the last N days
   * @param days - Number of days to include (default: 7)
   */
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
          [fn('DATE', col('createdAt')), 'date'],
          [fn('SUM', col('total')), 'revenue'],
          [fn('COUNT', col('id')), 'orderCount'],
        ],
        group: [fn('DATE', col('createdAt'))],
        order: [[fn('DATE', col('createdAt')), 'ASC']],
        raw: true,
      });

      return orders.map((order: any) => ({
        date: order.date,
        revenue: Number(this.toNumber(order.revenue, 0).toFixed(2)),
        orderCount: this.toNumber(order.orderCount, 0),
      }));
    } catch (error) {
      this.logger.error('Failed to get revenue by day', error);
      throw new InternalServerErrorException(
        'Failed to retrieve revenue analytics',
      );
    }
  }

  // -------------------------------
  // ORDER STATUS BREAKDOWN
  // -------------------------------
  /**
   * Get count of orders by status for today
   */
  async getOrderStatusBreakdown(): Promise<OrderBreakdown[]> {
    try {
      const today = this.getTodayStart();

      const breakdown = await this.orderModel.findAll({
        where: { createdAt: { [Op.gte]: today } },
        attributes: [
          'status',
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('total')), 'totalValue'],
        ],
        group: ['status'],
        raw: true,
      });

      return breakdown.map((item: any) => ({
        status: item.status,
        count: this.toNumber(item.count),
        totalValue: Number(this.toNumber(item.totalValue).toFixed(2)),
      }));
    } catch (error) {
      this.logger.error('Failed to get order status breakdown', error);
      throw new InternalServerErrorException(
        'Failed to retrieve order breakdown',
      );
    }
  }

  // -------------------------------
  // SYSTEM STATUS
  // -------------------------------
  /**
   * Get system health and activity metrics
   */
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const today = this.getTodayStart();

      const [qrScansToday, lastMenuSync, activeOrders] = await Promise.all([
        this.qrScanModel.count({
          where: { createdAt: { [Op.gte]: today } },
        }),

        this.menuItemModel.findOne({
          order: [['updatedAt', 'DESC']],
          attributes: ['updatedAt'],
        }),

        this.orderModel.count({
          where: {
            status: { [Op.in]: ACTIVE_STATUSES },
          },
        }),
      ]);

      return {
        whatsappConnection: 'Active', // TODO: Implement actual WhatsApp status check
        lastMenuSync: lastMenuSync?.updatedAt ?? null,
        qrScansToday,
        activeOrders,
      };
    } catch (error) {
      this.logger.error('Failed to get system status', error);
      throw new InternalServerErrorException(
        'Failed to retrieve system status',
      );
    }
  }

  // -------------------------------
  // LOW STOCK ALERTS
  // -------------------------------
  /**
   * Get menu items with low stock
   */
  async getLowStockItems(): Promise<MenuItem[]> {
    try {
      return await this.menuItemModel.findAll({
        where: {
          trackInventory: true,
          status: 'published',
          [Op.and]: [
            {
              stockQuantity: {
                [Op.lte]: col('lowStockAlert'),
              },
            },
          ],
        },
        order: [['stockQuantity', 'ASC']],
      });
    } catch (error) {
      this.logger.error('Failed to get low stock items', error);
      throw new InternalServerErrorException(
        'Failed to retrieve low stock items',
      );
    }
  }
}
