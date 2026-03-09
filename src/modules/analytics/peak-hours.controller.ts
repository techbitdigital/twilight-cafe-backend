import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { PeakHoursService } from "./peak-hours.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("api/analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class PeakHoursController {
  constructor(private readonly peakHoursService: PeakHoursService) {}

  /**
   * GET /api/analytics/peak-hours?days=30
   *
   * Response shape:
   * {
   *   data: [
   *     { hour, label, orders, revenue, avgOrderValue, isPeak },
   *     ...
   *   ],
   *   busiestHour:  { ...PeakHourEntry },
   *   quietestHour: { ...PeakHourEntry },
   *   peakPeriod:   "evening",
   *   totalOrdersAnalyzed: 428
   * }
   */
  @Get("peak-hours")
  getPeakHours(
    @Query("days", new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.peakHoursService.getPeakHours(days);
  }
}
