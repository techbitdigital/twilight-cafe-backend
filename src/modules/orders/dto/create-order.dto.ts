import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  IsObject,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";

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

  // ✅ Added fulfillmentType to resolve the TS2339 error
  @IsEnum(["delivery", "pickup"])
  @IsOptional()
  fulfillmentType?: "delivery" | "pickup";

  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @IsOptional()
  @IsObject()
  deliveryInfo?: Record<string, any>;
}
