export class DashboardStatsDto {
  ordersToday: number;
  revenueToday: number;
  totalMenuItems: number;
  avgOrderValue: number;
}

export class DashboardStatsResponseDto {
  success: boolean;
  message: string;
  data: DashboardStatsDto;
}
