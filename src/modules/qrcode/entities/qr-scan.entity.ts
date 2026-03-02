import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { QRCode } from './qrcode.entity';

@Table({ tableName: 'qr_scans', timestamps: true })
export class QRScan extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => QRCode)
  @Column({ type: DataType.UUID })
  declare qrCodeId: string;

  @BelongsTo(() => QRCode)
  declare qrCode: QRCode;

  @Column({ type: DataType.STRING })
  declare userIdentifier: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare convertedToOrder: boolean;

  @Column({ type: DataType.STRING })
  declare deviceType: string;

  @Column({ type: DataType.STRING })
  declare browser: string;
}
