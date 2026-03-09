/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

// Entities
import { Category } from './modules/menu/entities/category.entity';
import { MenuItem } from './modules/menu/entities/menu-item.entity';
import { ItemTag } from './modules/menu/entities/item-tag.entity';
import { MenuItemTag } from './modules/menu/entities/menu-item-tag.entity';
import { Variation } from './modules/menu/entities/variation.entity';
import { Addon } from './modules/menu/entities/addon.entity';
import { Order } from './modules/orders/entities/order.entity';
import { OrderItem } from './modules/orders/entities/order-item.entity';
import { QRCode } from './modules/qrcode/entities/qrcode.entity';
import { QRScan } from './modules/qrcode/entities/qr-scan.entity';
// import { WhatsAppSettings } from './modules/whatsapp/entities/whatsapp-settings.entity';
import { User } from './users/user.model';

// Modules
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { QRCodeModule } from './modules/qrcode/qrcode.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthController } from './health.controller';
// import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SettingsModule } from './modules/settings/settings.module';
import {NotificationsModule} from './modules/notifications/notifications.module';

@Module({
  imports: [
    // Load .env globally first
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Auth module must come after ConfigModule
    AuthModule,

    // Async Sequelize config
    SequelizeModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    console.log('🔍 Database Configuration Debug:');
    console.log('DB_HOST:', config.get<string>('DB_HOST'));
    console.log('DB_PORT:', config.get<string>('DB_PORT'));
    console.log('DB_USERNAME:', config.get<string>('DB_USERNAME'));
    console.log('DB_NAME:', config.get<string>('DB_NAME'));
    console.log('DB_PASSWORD exists:', !!config.get<string>('DB_PASSWORD'));

    return {
      dialect: 'mysql',
      host: config.get<string>('DB_HOST') || 'localhost',
      port: Number(config.get('DB_PORT')) || 3306,
      username: config.get<string>('DB_USERNAME'),
      password: config.get<string>('DB_PASSWORD'),
      database: config.get<string>('DB_NAME'), 
      autoLoadModels: true,
      synchronize: true,
      logging: console.log,
      models: [
        Category,
        MenuItem,
        ItemTag,
        MenuItemTag,
        Variation,
        Addon,
        Order,
        OrderItem,
        QRCode,
        QRScan,
        User,
      ],
    };
  },
}),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),

    MenuModule,
    OrdersModule,
    QRCodeModule,
    DashboardModule,
    AnalyticsModule,
    UsersModule,
    PaymentsModule,
    SettingsModule,
    NotificationsModule,
  ],
    controllers: [HealthController],

})
export class AppModule {}
