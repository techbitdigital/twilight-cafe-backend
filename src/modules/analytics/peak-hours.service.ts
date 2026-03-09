import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { fn, col, Op } from "sequelize";
import { Order } from "../orders/entities/order.entity";

export interface PeakHourEntry {
  hour: number;
  label: string;
  orders: number;
  revenue: number;
  avgOrderValue: number;
  isPeak: boolean;
}

export interface PeakHoursSummary {
  data: PeakHourEntry[];
  busiestHour: PeakHourEntry | null;
  quietestHour: PeakHourEntry | null;
  peakPeriod: "morning" | "afternoon" | "evening" | "night" | null;
  totalOrdersAnalyzed: number;
}

// Statuses that represent real, revenue-generating orders
const REVENUE_STATUSES = ["paid", "preparing", "ready", "completed"] as const;

@Injectable()
export class PeakHoursService {
  private readonly logger = new Logger(PeakHoursService.name);

  constructor(
    @InjectModel(Order)
    private readonly orderModel: typeof Order,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private formatHourLabel(hour: number): string {
    if (hour === 0) return "12AM";
    if (hour === 12) return "12PM";
    return hour < 12 ? `${hour}AM` : `${hour - 12}PM`;
  }

  private classifyPeriod(
    hour: number,
  ): "morning" | "afternoon" | "evening" | "night" {
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  }

  private buildDateFilter(days: number): Record<string, unknown> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    return { [Op.gte]: since };
  }

  // ─── Core query ─────────────────────────────────────────────────────────────

  async getPeakHours(days = 30): Promise<PeakHoursSummary> {
    try {
      // peak-hours.service.ts — fix group and order
      const rows = (await this.orderModel.findAll({
        attributes: [
          [fn("HOUR", col("createdAt")), "hour"],
          [fn("COUNT", col("id")), "orders"],
          [fn("SUM", col("total")), "revenue"],
        ],
        where: {
          status: { [Op.in]: REVENUE_STATUSES },
          createdAt: this.buildDateFilter(days),
        },
        // ✅ fn() is safe — Sequelize won't backtick-escape it
        group: [fn("HOUR", col("createdAt"))],
        order: [[fn("HOUR", col("createdAt")), "ASC"]],
        raw: true,
      })) as unknown as Array<{
        hour: number;
        orders: string;
        revenue: string;
      }>;

      if (!rows.length) {
        return {
          data: [],
          busiestHour: null,
          quietestHour: null,
          peakPeriod: null,
          totalOrdersAnalyzed: 0,
        };
      }

      const parsed = rows.map((r) => ({
        hour: Number(r.hour),
        orders: Number(r.orders),
        // ✅ `total` is DECIMAL — SUM returns a string from MySQL, parseFloat is correct
        revenue: parseFloat(r.revenue ?? "0"),
      }));

      // Top-3 hours by order count → flagged as peak
      const top3 = [...parsed]
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 3)
        .map((r) => r.hour);
      const peakSet = new Set(top3);

      const data: PeakHourEntry[] = parsed.map((r) => ({
        hour: r.hour,
        label: this.formatHourLabel(r.hour),
        orders: r.orders,
        revenue: parseFloat(r.revenue.toFixed(2)),
        avgOrderValue:
          r.orders > 0 ? parseFloat((r.revenue / r.orders).toFixed(2)) : 0,
        isPeak: peakSet.has(r.hour),
      }));

      const busiestHour = data.reduce((a, b) => (b.orders > a.orders ? b : a));
      const quietestHour = data.reduce((a, b) => (b.orders < a.orders ? b : a));

      return {
        data,
        busiestHour,
        quietestHour,
        peakPeriod: this.classifyPeriod(busiestHour.hour),
        totalOrdersAnalyzed: data.reduce((s, r) => s + r.orders, 0),
      };
    } catch (error) {
      this.logger.error(
        "Failed to compute peak hours",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
