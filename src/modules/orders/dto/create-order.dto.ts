import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsUUID()
  menuItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsUUID()
  variationId?: string;

  @IsOptional()
  @IsArray()
  addonIds?: string[];
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @IsOptional()
  @IsObject()
  deliveryInfo?: Record<string, any>;  // ← accepts any delivery info shape
}