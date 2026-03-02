// /* eslint-disable @typescript-eslint/no-unsafe-argument */
// /* eslint-disable @typescript-eslint/no-unsafe-call */
// /* eslint-disable @typescript-eslint/no-unsafe-member-access */
// /* eslint-disable @typescript-eslint/no-unsafe-assignment */
// /* eslint-disable @typescript-eslint/no-unsafe-return */
// // whatsapp/whatsapp-webhook.controller.ts
// import { Controller, Post, Body } from '@nestjs/common';
// import { InjectModel } from '@nestjs/sequelize';
// import { WhatsAppConversation } from './entities/whatsapp-conversation.entity';
// import { MenuItem } from '../menu/entities/menu-item.entity';
// import { OrdersService } from '../orders/orders.service';
// import { WhatsAppNotificationService } from './whatsapp-notification.service';

// @Controller('webhooks/whatsapp')
// export class WhatsAppWebhookController {
//   constructor(
//     @InjectModel(WhatsAppConversation)
//     private readonly conversationModel: typeof WhatsAppConversation,

//     @InjectModel(MenuItem)
//     private readonly menuItemModel: typeof MenuItem,

//     private readonly ordersService: OrdersService,
//     private readonly whatsappNotifier: WhatsAppNotificationService,
//   ) {}

//   @Post()
//   async handleIncomingMessage(@Body() body: any) {
//     const from = body.From.replace('whatsapp:', '');
//     const message = body.Body.trim().toLowerCase();

//     const convo = await this.conversationModel.findByPk(from);

//     /* =====================
//         STEP 1 – ITEMS
//     ===================== */
//     if (!convo) {
//       const items = this.parseItems(message);
//       if (!items.length) {
//         return this.reply(from, 'Please reply like: 1 x2, 3 x1');
//       }

//       await this.conversationModel.create({
//         phoneNumber: from,
//         step: 'NAME',
//         selectedItems: items,
//       });

//       return this.reply(from, 'Great 👍 What is your name?');
//     }

//     /* =====================
//         STEP 2 – NAME
//     ===================== */
//     if (convo.step === 'NAME') {
//       await convo.update({
//         customerName: body.Body,
//         step: 'INSTRUCTIONS',
//       });

//       return this.reply(from, 'Any special instructions? Reply "no" if none.');
//     }

//     /* =====================
//         STEP 3 – INSTRUCTIONS
//     ===================== */
//     if (convo.step === 'INSTRUCTIONS') {
//       const instructions = message === 'no' ? undefined : body.Body;

//       const order = await this.ordersService.createOrder({
//         customerName: convo.customerName!,
//         customerPhone: from,
//         orderSource: 'whatsapp',
//         specialInstructions: instructions,
//         items: convo.selectedItems,
//       });

//       await convo.destroy();

//       return this.reply(
//         from,
//         `✅ Order placed successfully!\nOrder No: ${order.orderNumber}\nThank you for ordering!`,
//       );
//     }
//   }

//   /* =====================
//       HELPERS
//   ===================== */

//   private async reply(to: string, message: string) {
//     await this.whatsappNotifier.notifyCustomer(to, message);
//   }

//   private parseItems(text: string) {
//     // Example: "1 x2, 3 x1"
//     const parts = text.split(',');
//     const items: any[] = [];

//     parts.forEach((p) => {
//       const match = p.match(/(\d+)\s*x\s*(\d+)/i);
//       if (!match) return;

//       const index = Number(match[1]) - 1;
//       const qty = Number(match[2]);

//       items.push({ index, quantity: qty });
//     });

//     return items;
//   }
// }
