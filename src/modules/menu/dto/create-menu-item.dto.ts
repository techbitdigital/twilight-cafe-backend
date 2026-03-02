import { Transform, Type } from 'class-transformer';
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
} from 'class-validator';

class VariationDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber()
  priceAdjustment: number;

  // FormData sends booleans as strings
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isAvailable: boolean;
}

class AddonDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber()
  price: number;

  @Transform(({ value }) => value === 'true' || value === true)
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

  // ✅ FormData sends numbers as strings — coerce them
  @Type(() => Number)
  @IsNumber()
  regularPrice: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salePrice?: number;

  // ✅ FormData sends booleans as "true"/"false" strings
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isAvailableForOrdering: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  preparationTime: number;

  @IsEnum(['draft', 'published'])
  status: string;

  @Transform(({ value }) => value === 'true' || value === true)
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

  // ✅ FormData sends arrays/objects as JSON strings — parse them
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationDto)
  variations?: VariationDto[];

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonDto)
  addons?: AddonDto[];

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}