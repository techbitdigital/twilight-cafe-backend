/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Transform, Type } from "class-transformer";
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsUUID,
  IsEnum,
  ValidateNested,
  Min,
} from "class-validator";

/**
 * Utility parser for multipart/form-data JSON fields
 */
function parseJsonArray(value: unknown) {
  if (!value) return [];

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }

  return value;
}

export class VariationDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber()
  priceAdjustment: number;

  @Transform(
    ({ value }: { value: unknown }) => value === "true" || value === true,
  )
  @IsBoolean()
  isAvailable: boolean;
}

export class AddonDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber()
  price: number;

  @Transform(
    ({ value }: { value: unknown }) => value === "true" || value === true,
  )
  @IsBoolean()
  isAvailable: boolean;
}

export class CreateMenuItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  categoryId: string;

  @Type(() => Number)
  @IsNumber()
  regularPrice: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salePrice?: number;

  @Transform(
    ({ value }: { value: unknown }) => value === "true" || value === true,
  )
  @IsBoolean()
  isAvailableForOrdering: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  preparationTime: number;

  @IsEnum(["draft", "published"])
  status: string;

  @Transform(
    ({ value }: { value: unknown }) => value === "true" || value === true,
  )
  @IsBoolean()
  trackInventory: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  stockQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lowStockAlert?: number;

  /**
   * Variations
   */
  @IsOptional()
  @Transform(({ value }) => parseJsonArray(value))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationDto)
  variations?: VariationDto[];

  /**
   * Addons
   */
  @IsOptional()
  @Transform(({ value }) => parseJsonArray(value))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonDto)
  addons?: AddonDto[];

  /**
   * Tags
   */
  @IsOptional()
  @Transform(({ value }) => parseJsonArray(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
