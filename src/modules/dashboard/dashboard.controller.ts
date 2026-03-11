import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import {
  DashboardService,
  OrderStatus,
  DashboardStats,
  TopSellingItem,
  SystemStatus,
} from "./dashboard.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Order } from "../orders/entities/order.entity";

// ✅ userId removed from all handlers — DashboardService methods no longer
//    accept it. The dashboard is admin-only and shows data across all customers.
@Controller("api/dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("stats")
  async getDashboardStats(): Promise<DashboardStats> {
    return this.dashboardService.getDashboardStats();
  }

  @Get("top-selling")
  async getTopSelling(
    @Query("limit", new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @Query("timeframe") timeframe?: "today" | "week" | "month" | "all",
  ): Promise<TopSellingItem[]> {
    return this.dashboardService.getTopSellingItems(limit, timeframe || "all");
  }

  @Get("recent-orders")
  async getRecentOrders(
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("status") status?: OrderStatus,
  ): Promise<Order[]> {
    return this.dashboardService.getRecentOrders(limit, status);
  }

  @Get("system-status")
  async getSystemStatus(): Promise<SystemStatus> {
    return this.dashboardService.getSystemStatus();
  }

  @Get("revenue-by-day")
  async getRevenueByDay(
    @Query("days", new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.dashboardService.getRevenueByDay(days);
  }

  @Get("order-breakdown")
  async getOrderStatusBreakdown() {
    return this.dashboardService.getOrderStatusBreakdown();
  }

  @Get("low-stock")
  async getLowStockItems() {
    return this.dashboardService.getLowStockItems();
  }
}
