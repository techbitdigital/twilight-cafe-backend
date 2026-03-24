import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  IsEnum,
  IsObject,
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

  @IsEnum(["pick-up", "eat-in"])
  @IsOptional()
  orderType?: "pick-up" | "eat-in";

  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @IsOptional()
  @IsObject()
  deliveryInfo?: Record<string, any>;
}
