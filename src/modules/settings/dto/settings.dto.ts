import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  IsBoolean,
} from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: "New password must be at least 8 characters" })
  newPassword: string;

  @IsString()
  confirmPassword: string;
}

export class UpdateNotificationsDto {
  @IsBoolean()
  @IsOptional()
  newOrders?: boolean;

  @IsBoolean()
  @IsOptional()
  lowStock?: boolean;

  @IsBoolean()
  @IsOptional()
  emailSummary?: boolean;
}
