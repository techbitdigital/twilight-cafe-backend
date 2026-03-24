/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule, SequelizeModuleOptions } from '@nestjs/sequelize';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { Sequelize } from 'sequelize';

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
import { User } from './users/user.model';

// Modules
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { QRCodeModule } from './modules/qrcode/qrcode.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    AuthModule,

    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): SequelizeModuleOptions => {
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
          hooks: {
            afterSync: async (options: { sequelize: Sequelize }) => {
              const sequelize = options.sequelize;

              const [results] = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = '${config.get<string>('DB_NAME')}'
                  AND TABLE_NAME = 'orders' 
                  AND COLUMN_NAME = 'orderSource'
              `);

              if (results.length > 0) {
                console.log('🔄 Migrating: renaming order_source → order_type...');
                await sequelize.query(`
                  ALTER TABLE orders 
                  CHANGE orderSource orderType ENUM('pick-up', 'eat-in') NOT NULL DEFAULT 'pick-up'
                `);
                console.log('✅ Migration complete: order_source renamed to order_type');
              }
            },
          } as any, 
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