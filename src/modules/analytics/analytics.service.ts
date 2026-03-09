import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Order } from "../orders/entities/order.entity";
import { QRScan } from "../qrcode/entities/qr-scan.entity";
import { fn, col, literal, Op } from "sequelize";
import { OrderItem } from "../orders/entities/order-item.entity";
import { MenuItem } from "../menu/entities/menu-item.entity";

export interface BestSellingItem {
  rank: number;
  menuItemId: string;
  name: string;
  image: string | null;
  totalSold: number;
  totalRevenue: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  customerReach: number;
  trends: {
    totalRevenue: string;
    totalOrders: string;
    avgOrderValue: string;
    customerReach: string;
  };
}

const REVENUE_STATUSES = ["paid", "preparing", "ready", "completed"] as const;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(Order)
    private orderModel: typeof Order,

    @InjectModel(QRScan)
    private qrScanModel: typeof QRScan,

    @InjectModel(OrderItem)
    private readonly orderItemModel: typeof OrderItem,

    @InjectModel(MenuItem)
    private readonly menuItemModel: typeof MenuItem,
  ) {}

  // Add to AnalyticsService
  async getDashboardStats(period: string = "7days"): Promise<DashboardStats> {
    try {
      const days = this.parsePeriodToDays(period);
      const thisStart = this.buildDateFilter(days);
      const lastStart = this.buildDateFilter(days * 2); // previous period

      const queryPeriod = async (from: Date, to: Date) => {
        const orders = (await this.orderModel.findAll({
          attributes: ["total", "customerPhone"],
          where: {
            status: { [Op.in]: REVENUE_STATUSES },
            createdAt: { [Op.between]: [from, to] },
          },
          raw: true,
        })) as unknown as Array<{ total: string; customerPhone: string }>;

        const totalOrders = orders.length;
        const totalRevenue = orders.reduce(
          (sum, o) => sum + parseFloat(o.total ?? "0"),
          0,
        );
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const customerReach = new Set(orders.map((o) => o.customerPhone)).size;

        return { totalRevenue, totalOrders, avgOrderValue, customerReach };
      };

      const [current, previous] = await Promise.all([
        queryPeriod(thisStart, new Date()),
        queryPeriod(lastStart, thisStart),
      ]);

      // Returns "+15.2" / "-3.1" / "0.0"
      const pct = (curr: number, prev: number): string => {
        if (prev === 0) return curr > 0 ? "+100.0" : "0.0";
        const change = ((curr - prev) / prev) * 100;
        return (change >= 0 ? "+" : "") + change.toFixed(1);
      };

      return {
        totalRevenue: parseFloat(current.totalRevenue.toFixed(2)),
        totalOrders: current.totalOrders,
        avgOrderValue: parseFloat(current.avgOrderValue.toFixed(2)),
        customerReach: current.customerReach,
        trends: {
          totalRevenue: pct(current.totalRevenue, previous.totalRevenue),
          totalOrders: pct(current.totalOrders, previous.totalOrders),
          avgOrderValue: pct(current.avgOrderValue, previous.avgOrderValue),
          customerReach: pct(current.customerReach, previous.customerReach),
        },
      };
    } catch (error) {
      this.logger.error(
        "Failed to get dashboard stats",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
  async getBestSellingItems(
    period: string,
    limit = 10,
  ): Promise<BestSellingItem[]> {
    try {
      const days = this.parsePeriodToDays(period);
      const since = this.buildDateFilter(days);

      const rows = (await this.orderItemModel.findAll({
        attributes: [
          "menuItemId",
          "itemName",
          [fn("SUM", col("OrderItem.quantity")), "totalSold"],
          [
            fn("SUM", literal("`OrderItem`.`quantity` * `OrderItem`.`price`")),
            "totalRevenue",
          ],
        ],
        include: [
          {
            model: Order,
            attributes: [],
            where: {
              status: { [Op.in]: REVENUE_STATUSES },
              createdAt: { [Op.gte]: since },
            },
            required: true,
          },
        ],
        group: ["OrderItem.menuItemId", "OrderItem.itemName"],
        order: [[literal("totalSold"), "DESC"]],
        limit,
        subQuery: false,
        raw: true,
      })) as unknown as Array<{
        menuItemId: string;
        itemName: string;
        totalSold: string;
        totalRevenue: string;
      }>;

      if (!rows.length) return [];

      const menuItemIds = rows.map((r) => r.menuItemId);

      const menuItems = (await this.menuItemModel.findAll({
        attributes: ["id", "images"],
        where: { id: { [Op.in]: menuItemIds } },
        raw: true,
      })) as unknown as Array<{ id: string; images: string[] }>;

      const imageMap = new Map(
        menuItems.map((m) => [
          m.id,
          Array.isArray(m.images) && m.images.length > 0 ? m.images[0] : null,
        ]),
      );

      return rows.map((row, index) => ({
        rank: index + 1,
        menuItemId: row.menuItemId,
        name: row.itemName,
        image: imageMap.get(row.menuItemId) ?? null,
        totalSold: Number(row.totalSold),
        totalRevenue: parseFloat(parseFloat(row.totalRevenue).toFixed(2)),
      }));
    } catch (error) {
      this.logger.error(
        "Failed to get best selling items",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private parsePeriodToDays(period: string): number {
    const match = period?.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 7;
  }

  private buildDateFilter(days: number): Date {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    return since;
  }

  async getAnalytics(startDate?: Date, endDate?: Date) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    const [totalRevenue, totalOrders, totalScans, uniqueUsers, conversions] =
      await Promise.all([
        this.orderModel.sum("total", {
          where: {
            ...dateFilter,
            status: { [Op.in]: ["completed", "ready", "preparing"] },
          },
        }),
        this.orderModel.count({ where: dateFilter }),
        this.qrScanModel.count({ where: dateFilter }),
        this.qrScanModel.count({
          where: dateFilter,
          distinct: true,
          col: "userIdentifier",
        }),
        this.qrScanModel.count({
          where: { ...dateFilter, convertedToOrder: true },
        }),
      ]);

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate =
      totalScans > 0 ? (conversions / totalScans) * 100 : 0;

    return {
      totalRevenue: totalRevenue || 0,
      totalOrders,
      avgOrderValue: avgOrderValue.toFixed(2),
      customerReach: uniqueUsers,
      qrAnalytics: {
        totalScans,
        uniqueUsers,
        conversionRate: conversionRate.toFixed(2),
      },
    };
  }

  async getRevenueOverTime(startDate: Date, endDate: Date) {
    const dateFilter = this.getDateFilter(startDate, endDate);
    const sequelize = this.orderModel.sequelize!;

    const orders = await this.orderModel.findAll({
      where: {
        ...dateFilter,
        status: { [Op.in]: ["completed", "ready", "preparing"] },
      },
      attributes: [
        [sequelize.fn("DATE", sequelize.col("createdAt")), "date"],
        [sequelize.fn("SUM", sequelize.col("total")), "revenue"],
        [sequelize.fn("COUNT", sequelize.col("id")), "orders"],
      ],
      group: [sequelize.fn("DATE", sequelize.col("createdAt"))],
      order: [[sequelize.fn("DATE", sequelize.col("createdAt")), "ASC"]],
      raw: true,
    });

    return orders;
  }

  async getScanActivityOverTime(startDate: Date, endDate: Date) {
    const dateFilter = this.getDateFilter(startDate, endDate);
    const sequelize = this.qrScanModel.sequelize!;

    const scans = await this.qrScanModel.findAll({
      where: dateFilter,
      attributes: [
        [sequelize.fn("DATE", sequelize.col("createdAt")), "date"],
        [sequelize.fn("COUNT", sequelize.col("id")), "scans"],
      ],
      group: [sequelize.fn("DATE", sequelize.col("createdAt"))],
      order: [[sequelize.fn("DATE", sequelize.col("createdAt")), "ASC"]],
      raw: true,
    });

    return scans;
  }

  private getDateFilter(startDate?: Date, endDate?: Date) {
    if (!startDate && !endDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return { createdAt: { [Op.gte]: thirtyDaysAgo } };
    }

    if (startDate && endDate) {
      return { createdAt: { [Op.between]: [startDate, endDate] } };
    }

    if (startDate) {
      return { createdAt: { [Op.gte]: startDate } };
    }

    return { createdAt: { [Op.lte]: endDate } };
  }
}
