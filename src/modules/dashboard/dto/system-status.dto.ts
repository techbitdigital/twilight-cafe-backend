export class SystemStatusDto {
  whatsappConnection: string;
  lastMenuSync: Date | null;
  qrScansToday: number;
}

export class SystemStatusResponseDto {
  success: boolean;
  message: string;
  data: SystemStatusDto;
}
