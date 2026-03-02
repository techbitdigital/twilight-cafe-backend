// import { Controller, Get, Put, Post, Body } from '@nestjs/common';
// import { WhatsAppService } from './whatsapp.service';
// import { CreateOrderDto } from '../orders/dto/create-order.dto';
// import { WhatsAppPreviewDto } from './dto/whatsapp-preview.dto';
// import { UpdateWhatsAppSettingsDto } from './dto/update-whatsapp-settings.dto';

// @Controller('api/whatsapp')
// export class WhatsAppController {
//   constructor(private readonly whatsappService: WhatsAppService) {}

//   /* ============================
//       SETTINGS
//   ============================ */

//   @Get('settings')
//   getSettings() {
//     return this.whatsappService.getSettings();
//   }

//   @Put('settings')
//   updateSettings(@Body() data: UpdateWhatsAppSettingsDto) {
//     // ✅ Use DTO
//     return this.whatsappService.updateSettings(data);
//   }

//   /* ============================
//       CONNECTION
//   ============================ */

//   @Post('test-connection')
//   testConnection() {
//     return this.whatsappService.testConnection();
//   }

//   /* ============================
//       MENU ITEM PREVIEW
//   ============================ */

//   @Post('preview')
//   getPreview(@Body() dto: WhatsAppPreviewDto) {
//     return this.whatsappService.getPreviewData(dto.menuItemId);
//   }

//   /* ============================
//       GENERATE ORDER MESSAGE
//   ============================ */

//   @Post('generate-message')
//   generateMessage(@Body() dto: CreateOrderDto) {
//     return this.whatsappService.generateWhatsAppOrderMessage(dto);
//   }
// }
