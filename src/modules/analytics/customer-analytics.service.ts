import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { fn, col, Op } from "sequelize";
import { Order } from "../orders/entities/order.entity";

const REVENUE_STATUSES = ["paid", "preparing", "ready", "completed"] as const;

export interface CustomerBehaviorResult {
  newCustomers: number;
  returningCustomers: number;
  totalCustomers: number;
  returnRate: string;
}

export interface ComparisonResult {
  revenue: string;
  orders: number;
  aov: string;
  customers: number;
  trends: {
    revenue: string;
    orders: string;
    aov: string;
    customers: string;
  };
}

@Injectable()
export class CustomerAnalyticsService {
  private readonly logger = new Logger(CustomerAnalyticsService.name);

  constructor(
    @InjectModel(Order)
    private readonly orderModel: typeof Order,
  ) {}

  private parseDays(period: string): number {
    const match = period?.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 7;
  }

  private dateFrom(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async getCustomerBehavior(period: string): Promise<CustomerBehaviorResult> {
    try {
      const days = this.parseDays(period);
      const since = this.dateFrom(days);

      // All unique phones in the period
      const periodOrders = (await this.orderModel.findAll({
        attributes: ["customerPhone"],
        where: {
          status: { [Op.in]: REVENUE_STATUSES },
          createdAt: { [Op.gte]: since },
        },
        raw: true,
      })) as unknown as Array<{ customerPhone: string }>;

      const periodPhones = new Set(periodOrders.map((o) => o.customerPhone));

      // Phones that ordered BEFORE this period → returning
      const returningOrders = (await this.orderModel.findAll({
        attributes: ["customerPhone"],
        where: {
          status: { [Op.in]: REVENUE_STATUSES },
          createdAt: { [Op.lt]: since },
          customerPhone: { [Op.in]: [...periodPhones] },
        },
        raw: true,
      })) as unknown as Array<{ customerPhone: string }>;

      const returningPhones = new Set(
        returningOrders.map((o) => o.customerPhone),
      );
      const returningCustomers = returningPhones.size;
      const newCustomers = periodPhones.size - returningCustomers;
      const totalCustomers = periodPhones.size;

      return {
        newCustomers: Math.max(newCustomers, 0),
        returningCustomers,
        totalCustomers,
        returnRate:
          totalCustomers > 0
            ? ((returningCustomers / totalCustomers) * 100).toFixed(1)
            : "0.0",
      };
    } catch (error) {
      this.logger.error("Failed to get customer behavior", error);
      throw error;
    }
  }

  async getComparison(period: string): Promise<ComparisonResult> {
    try {
      const days = this.parseDays(period);
      const thisStart = this.dateFrom(days);
      const lastStart = this.dateFrom(days * 2);

      const query = async (from: Date, to: Date) => {
        const rows = (await this.orderModel.findAll({
          attributes: [
            [fn("SUM", col("total")), "revenue"],
            [fn("COUNT", col("id")), "orders"],
            [fn("COUNT", fn("DISTINCT", col("customerPhone"))), "customers"],
          ],
          where: {
            status: { [Op.in]: REVENUE_STATUSES },
            createdAt: { [Op.between]: [from, to] },
          },
          raw: true,
        })) as unknown as Array<{
          revenue: string;
          orders: string;
          customers: string;
        }>;

        const r = rows[0] ?? { revenue: "0", orders: "0", customers: "0" };
        const revenue = parseFloat(r.revenue ?? "0");
        const orders = parseInt(r.orders ?? "0", 10);
        const customers = parseInt(r.customers ?? "0", 10);
        const aov = orders > 0 ? revenue / orders : 0;

        return { revenue, orders, customers, aov };
      };

      const [current, previous] = await Promise.all([
        query(thisStart, new Date()),
        query(lastStart, thisStart),
      ]);

      // % change helper — returns "+15.2" or "-8.0"
      const pct = (curr: number, prev: number): string => {
        if (prev === 0) return curr > 0 ? "+100.0" : "0.0";
        const change = ((curr - prev) / prev) * 100;
        return (change >= 0 ? "+" : "") + change.toFixed(1);
      };

      return {
        revenue: current.revenue.toFixed(2),
        orders: current.orders,
        aov: current.aov.toFixed(2),
        customers: current.customers,
        trends: {
          revenue: pct(current.revenue, previous.revenue),
          orders: pct(current.orders, previous.orders),
          aov: pct(current.aov, previous.aov),
          customers: pct(current.customers, previous.customers),
        },
      };
    } catch (error) {
      this.logger.error("Failed to get comparison", error);
      throw error;
    }
  }
}
