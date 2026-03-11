/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Request,
  Query,
  UseGuards,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { GetUser } from "../../common/decorators/get-user.decorator";
import { User } from "../../users/user.model";

@Controller("api/orders")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * CREATE ORDER
   */
  @Post()
  @Roles("customer", "admin")
  createOrder(@GetUser() user: User, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user, dto);
  }

  /**
   * GET ALL ORDERS
   * Customers: own orders only. Admins: all orders.
   */
  @Get()
  getAllOrders(
    @GetUser() user: User,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("timeFilter") timeFilter?: "last-hour",
    @Query("sort") sort?: "oldest" | "newest",
  ) {
    if (user.role === "customer") {
      return this.ordersService.getCustomerOrders(user.id, {
        status,
        search,
        timeFilter,
        sort,
      });
    }
    return this.ordersService.getAllOrders({
      status,
      search,
      timeFilter,
      sort,
    });
  }

  /**
   * GET ORDER STATS
   * ✅ Fix 5: Added `period` query param so fetchOrderStatistics("today")
   *    from the frontend slice actually reaches the service method correctly.
   *    Without this, the period was silently dropped and stats were unfiltered.
   * Admin only.
   */
  @Get("stats")
  @Roles("admin")
  getOrderStats(@Query("period") period: "today" | "week" | "month" = "today") {
    return this.ordersService.getOrderStats(period);
  }

  /**
   * REJECT ORDER — Admin only.
   * NOTE: must stay above :id/status and :id to avoid route shadowing.
   */
  @Patch(":id/reject")
  @Roles("admin")
  rejectOrder(@Param("id") id: string, @Body("reason") reason?: string) {
    return this.ordersService.rejectOrder(id, reason);
  }

  /**
   * UPDATE ORDER STATUS
   * Customers can mark their own order as "paid".
   * Admins can transition to any status.
   */
  @Put(":id/status")
  @UseGuards(JwtAuthGuard)
  updateOrderStatus(
    @Param("id") id: string,
    @Body("status") status: string,
    @Request() req,
  ) {
    return this.ordersService.updateOrderStatus(id, status, req.user);
  }

  /**
   * GET SINGLE ORDER
   * Customers: own order only. Admins: any order.
   */
  @Get(":id")
  getOrder(@GetUser() user: User, @Param("id") id: string) {
    return this.ordersService.getOrderWithAccess(id, user);
  }
}
