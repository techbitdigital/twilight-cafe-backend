export class TopSellingItemDto {
  menuItemId: string;
  itemName: string;
  totalOrders: number;
  avgPrice: number;
  image: string | null;
}

export class TopSellingItemsResponseDto {
  success: boolean;
  message: string;
  data: TopSellingItemDto[];
}
