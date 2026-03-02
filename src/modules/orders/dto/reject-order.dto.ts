import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RejectOrderDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reason: string;
}