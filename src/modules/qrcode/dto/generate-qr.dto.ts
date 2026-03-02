import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateQRCodeDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsObject()
  @IsOptional()
  customization?: {
    color?: string;
  };
}

// Export the type for the service
export type CreateQRCodeInput = CreateQRCodeDto;
