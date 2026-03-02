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
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { User } from '../../users/user.model';

@Controller('api/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * CREATE ORDER
   * - Customers can create their own orders
   * - Admins can create orders on behalf of customers
   */
  @Post()
  @Roles('customer', 'admin')
  createOrder(@GetUser() user: User, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user, dto);
  }

  /**
   * GET ALL ORDERS
   * - Customers: See only their own orders
   * - Admins: See all orders
   */
  @Get()
  getAllOrders(
    @GetUser() user: User,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('timeFilter') timeFilter?: 'last-hour',
    @Query('sort') sort?: 'oldest' | 'newest',
  ) {
    // Customers can only see their own orders
    if (user.role === 'customer') {
      return this.ordersService.getCustomerOrders(user.id, {
        status,
        search,
        timeFilter,
        sort,
      });
    }

    // Admins can see all orders
    return this.ordersService.getAllOrders({
      status,
      search,
      timeFilter,
      sort,
    });
  }

  /**
   * GET ORDER STATS
   * - Admin only
   */
  @Get('stats')
  @Roles('admin')
  getOrderStats() {
    return this.ordersService.getOrderStats();
  }
  
  /**
 * REJECT ORDER
 * - Admin only
 */
@Patch(':id/reject')
@Roles('admin')
rejectOrder(
  @Param('id') id: string,
  @Body('reason') reason?: string,
) {
  return this.ordersService.rejectOrder(id, reason);
}
  /**
   * GET ORDERS BY STATUS
   * - Admin only (for kitchen/management dashboard)
   */
 // ✅ FIXED — customers and admins can call this
@Put(':id/status')
@UseGuards(JwtAuthGuard)   // ← removed RolesGuard and @Roles('admin')
updateOrderStatus(
  @Param('id') id: string,
  @Body('status') status: string,
  @Request() req,
) {
  return this.ordersService.updateOrderStatus(id, status, req.user);
}

  /**
   * GET SINGLE ORDER
   * - Customers: Can only view their own order
   * - Admins: Can view any order
   */
  @Get(':id')
  getOrder(@GetUser() user: User, @Param('id') id: string) {
    return this.ordersService.getOrderWithAccess(id, user);
  }

}
