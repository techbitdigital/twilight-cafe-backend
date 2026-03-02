// import {
//   Injectable,
//   InternalServerErrorException,
//   Logger,
//   NotFoundException,
//   BadRequestException,
// } from '@nestjs/common';
// import { InjectModel } from '@nestjs/sequelize';
// import { WhatsAppSettings } from './entities/whatsapp-settings.entity';
// import { MenuItem } from '../menu/entities/menu-item.entity';
// import { Category } from '../menu/entities/category.entity';
// import { CreateOrderDto } from '../orders/dto/create-order.dto';
// import { UpdateWhatsAppSettingsDto } from './dto/update-whatsapp-settings.dto';

// @Injectable()
// export class WhatsAppService {
//   private readonly logger = new Logger(WhatsAppService.name);

//   constructor(
//     @InjectModel(WhatsAppSettings)
//     private readonly whatsappSettingsModel: typeof WhatsAppSettings,

//     @InjectModel(MenuItem)
//     private readonly menuItemModel: typeof MenuItem,
//   ) {}

//   /* ============================
//       SETTINGS
//   ============================ */

//   async getSettings(): Promise<WhatsAppSettings> {
//     try {
//       let settings = await this.whatsappSettingsModel.findOne();

//       if (!settings) {
//         settings = await this.whatsappSettingsModel.create({
//           phoneNumber: process.env.WHATSAPP_BUSINESS_NUMBER || '',
//           welcomeMessage:
//             'Welcome to our cafe! Browse our menu and place your order.',
//           isActive: true,
//           connectionStatus: 'Active',
//         });

//         this.logger.log('Created default WhatsApp settings');
//       }

//       return settings;
//     } catch (error) {
//       this.logger.error('Failed to load WhatsApp settings', error as Error);
//       throw new InternalServerErrorException(
//         'Could not access WhatsApp configuration',
//       );
//     }
//   }

//   async updateSettings(
//     data: UpdateWhatsAppSettingsDto,
//   ): Promise<WhatsAppSettings> {
//     const settings = await this.getSettings();
//     return settings.update(data);
//   }

//   /* ============================
//       PREVIEW DATA
//   ============================ */

//   async getPreviewData(menuItemId: string) {
//     const settings = await this.getSettings();

//     const menuItem = await this.menuItemModel.findOne({
//       where: {
//         id: menuItemId,
//         status: 'published',
//         isAvailableForOrdering: true,
//       },
//       include: [{ model: Category }],
//     });

//     if (!menuItem) {
//       throw new NotFoundException(
//         'Menu item not found or not available for ordering',
//       );
//     }

//     const price = this.calculatePrice(menuItem);

//     return {
//       cafeName: process.env.CAFE_NAME || 'Our Cafe',
//       cafeLogo: process.env.CAFE_LOGO_URL,
//       whatsappStatus: settings.connectionStatus,
//       phoneNumber: settings.phoneNumber,
//       menuItem: {
//         image: menuItem.images?.[0],
//         name: menuItem.name,
//         description: menuItem.description,
//         category: menuItem.category?.name,
//         price,
//       },
//     };
//   }

//   /* ============================
//       GENERATE ORDER MESSAGE
//   ============================ */

//   async generateWhatsAppOrderMessage(dto: CreateOrderDto) {
//     if (!dto.items || dto.items.length === 0) {
//       throw new BadRequestException('Order must contain at least one item');
//     }

//     const settings = await this.getSettings();
//     const cafeName = process.env.CAFE_NAME || 'Our Cafe';

//     // 🔹 Fetch ONLY ordered menu items
//     const orderedItemIds = dto.items.map((i) => i.menuItemId);

//     const menuItems = await this.menuItemModel.findAll({
//       where: {
//         id: orderedItemIds,
//         status: 'published',
//         isAvailableForOrdering: true,
//       },
//     });

//     if (menuItems.length !== orderedItemIds.length) {
//       throw new NotFoundException('One or more ordered items are unavailable');
//     }

//     let subtotal = 0;

//     const itemLines = dto.items.map((item, index) => {
//       const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;

//       const unitPrice = this.calculatePrice(menuItem);
//       const lineTotal = unitPrice * item.quantity;

//       subtotal += lineTotal;

//       return `${index + 1}. ${menuItem.name} x${item.quantity} – ₦${lineTotal.toLocaleString()}`;
//     });

//     const tax = Number((subtotal * 0.05).toFixed(2));
//     const total = Number((subtotal + tax).toFixed(2));

//     const message = `
// 🎉 *New Order from ${cafeName}*

// 👤 *Customer:* ${dto.customerName}
// 📞 *Phone:* ${dto.customerPhone}

// 🧾 *Items*
// ${itemLines.join('\n')}

// Subtotal: ₦${subtotal.toLocaleString()}
// Tax (5%): ₦${tax.toLocaleString()}
// *Total: ₦${total.toLocaleString()}*

// 📝 *Notes:* ${dto.specialInstructions ?? 'None'}

// Reply *YES* to confirm this order.
//     `.trim();

//     return {
//       message,
//       phoneNumber: settings.phoneNumber,
//     };
//   }

//   /* ============================
//       PRIVATE HELPERS
//   ============================ */

//   private calculatePrice(menuItem: MenuItem): number {
//     if (menuItem.salePrice != null) {
//       const sale = Number(menuItem.salePrice);
//       if (!isNaN(sale) && sale > 0) return sale;
//     }

//     if (menuItem.regularPrice != null) {
//       const regular = Number(menuItem.regularPrice);
//       if (!isNaN(regular) && regular > 0) return regular;
//     }

//     throw new InternalServerErrorException(
//       `Menu item "${menuItem.name}" has invalid pricing`,
//     );
//   }

//   /* ============================
//     TEST CONNECTION
// ============================ */

//   async testConnection() {
//     const settings = await this.getSettings();

//     // Since Twilio is already configured, we just validate config presence
//     const isConfigured =
//       Boolean(process.env.TWILIO_ACCOUNT_SID) &&
//       Boolean(process.env.TWILIO_AUTH_TOKEN) &&
//       Boolean(settings.phoneNumber);

//     await settings.update({
//       lastConnectionTest: new Date(),
//       connectionStatus: isConfigured ? 'Active' : 'Disconnected',
//     });

//     this.logger.log(
//       `WhatsApp connection test: ${isConfigured ? 'SUCCESS' : 'FAILED'}`,
//     );

//     return {
//       success: isConfigured,
//       status: isConfigured ? 'Active' : 'Disconnected',
//       phoneNumber: settings.phoneNumber,
//       lastTest: settings.lastConnectionTest,
//       message: isConfigured
//         ? 'WhatsApp is properly configured and ready'
//         : 'WhatsApp configuration is incomplete',
//     };
//   }
// }
