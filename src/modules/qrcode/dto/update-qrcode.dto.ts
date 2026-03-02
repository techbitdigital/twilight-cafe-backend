import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpdateQRCodeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  customization?: {
    color?: string;
  };
}

// Export the type for the service
export type UpdateQRCodeInput = UpdateQRCodeDto;
