import { IsOptional, IsString, IsIn, IsEmail } from "class-validator";

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(["customer", "admin"])
  role?: "customer" | "admin";
}
