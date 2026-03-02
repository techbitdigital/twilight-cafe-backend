import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class TrackScanDto {
  @IsString()
  @IsNotEmpty()
  userIdentifier: string;

  @IsBoolean()
  @IsOptional()
  convertedToOrder?: boolean;

  @IsString()
  @IsOptional()
  deviceType?: string;

  @IsString()
  @IsOptional()
  browser?: string;
}

// Export the type for the service
export type TrackScanInput = TrackScanDto;
