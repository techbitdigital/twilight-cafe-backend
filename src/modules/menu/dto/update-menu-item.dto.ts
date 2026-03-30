import { PartialType } from "@nestjs/mapped-types";
import { CreateMenuItemDto } from "./create-menu-item.dto";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return Boolean(value);
}

export class UpdateMenuItemDto extends PartialType(CreateMenuItemDto) {
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isAvailableForOrdering?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  trackInventory?: boolean;
}
