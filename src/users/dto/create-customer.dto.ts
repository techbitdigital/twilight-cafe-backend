// users/dto/create-customer.dto.ts
import { IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DeliveryInfoDto {
  @IsString()
  streetAddress: string;

  @IsString()
  apartmentNumber: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class CreateCustomerDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryInfoDto)
  deliveryInfo?: DeliveryInfoDto;
}
