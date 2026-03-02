import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Order } from '../orders/entities/order.entity';
import { QRScan } from '../qrcode/entities/qr-scan.entity';
import { Op } from 'sequelize';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Order)
    private orderModel: typeof Order,
    @InjectModel(QRScan)
    private qrScanModel: typeof QRScan,
  ) {}

  async getAnalytics(startDate?: Date, endDate?: Date) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    const [totalRevenue, totalOrders, totalScans, uniqueUsers, conversions] =
      await Promise.all([
        this.orderModel.sum('total', {
          where: {
            ...dateFilter,
            status: { [Op.in]: ['completed', 'ready', 'preparing'] },
          },
        }),
        this.orderModel.count({ where: dateFilter }),
        this.qrScanModel.count({ where: dateFilter }),
        this.qrScanModel.count({
          where: dateFilter,
          distinct: true,
          col: 'userIdentifier',
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
        status: { [Op.in]: ['completed', 'ready', 'preparing'] },
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('SUM', sequelize.col('total')), 'revenue'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
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
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'scans'],
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
      raw: true,
    });

    return scans;
  }

  private getDateFilter(startDate?: Date, endDate?: Date) {
    if (!startDate && !endDate) {
      // Default to last 30 days
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
