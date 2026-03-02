// import { Module } from '@nestjs/common';
// import { SequelizeModule } from '@nestjs/sequelize';
// import { ConfigModule } from '@nestjs/config';

// import { WhatsAppController } from './whatsapp.controller';
// import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
// import { WhatsAppService } from './whatsapp.service';
// import { WhatsAppNotificationService } from './whatsapp-notification.service';

// import { WhatsAppSettings } from './entities/whatsapp-settings.entity';
// import { WhatsAppConversation } from './entities/whatsapp-conversation.entity';
// import { MenuItem } from '../menu/entities/menu-item.entity';
// import { Category } from '../menu/entities/category.entity';

// import { OrdersModule } from '../orders/orders.module'; // ✅ IMPORT

// @Module({
//   imports: [
//     SequelizeModule.forFeature([
//       WhatsAppSettings,
//       WhatsAppConversation,
//       MenuItem,
//       Category,
//     ]),
//     ConfigModule,
//     OrdersModule, // ✅ Make OrdersService injectable
//   ],
//   controllers: [WhatsAppController, WhatsAppWebhookController],
//   providers: [WhatsAppService, WhatsAppNotificationService],
//   exports: [WhatsAppService, WhatsAppNotificationService],
// })
// export class WhatsAppModule {}
