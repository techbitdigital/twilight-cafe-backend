import {
  Controller,
  Get,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("api/analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getAnalytics(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getAnalytics(start, end);
  }
  @Get("dashboard-stats")
  getDashboardStats(
    @Query("period", new DefaultValuePipe("7days")) period: string,
  ) {
    return this.analyticsService.getDashboardStats(period);
  }
  @Get("revenue-overtime")
  async getRevenueOverTime(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ) {
    return this.analyticsService.getRevenueOverTime(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get("scan-activity")
  async getScanActivity(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ) {
    return this.analyticsService.getScanActivityOverTime(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get("menu-performance")
  getBestSellingItems(
    @Query("period", new DefaultValuePipe("7days")) period: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.analyticsService.getBestSellingItems(period, limit);
  }
}
