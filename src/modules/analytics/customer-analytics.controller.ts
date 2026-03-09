import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CustomerAnalyticsService } from "./customer-analytics.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("api/analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class CustomerAnalyticsController {
  constructor(private readonly service: CustomerAnalyticsService) {}

  // GET /api/analytics/customers?period=7days
  @Get("customers")
  getCustomerBehavior(@Query("period") period: string = "7days") {
    return this.service.getCustomerBehavior(period);
  }

  // GET /api/analytics/comparison?period=7days
  @Get("comparison")
  getComparison(@Query("period") period: string = "7days") {
    return this.service.getComparison(period);
  }
}
