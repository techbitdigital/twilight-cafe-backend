// qrcode.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { QRCodeController } from './qrcode.controller';
import { QRCodeService } from './qrcode.service';
import { QRCode } from './entities/qrcode.entity';
import { QRScan } from './entities/qr-scan.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';

@Module({
  imports: [SequelizeModule.forFeature([QRCode, QRScan, MenuItem])],
  controllers: [QRCodeController],
  providers: [QRCodeService],
  exports: [QRCodeService],
})
export class QRCodeModule {}
