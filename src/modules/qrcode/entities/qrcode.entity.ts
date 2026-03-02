import { Table, Column, Model, DataType, HasMany } from 'sequelize-typescript';
import { QRScan } from './qr-scan.entity';

@Table({ tableName: 'qr_codes', timestamps: true })
export class QRCode extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare url: string;

  @Column({ type: DataType.TEXT })
  declare qrCodeDataUrl: string;

  @Column({ type: DataType.JSON })
  declare customization: Record<string, any>;

  @Column({ type: DataType.STRING })
  declare location: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  declare isActive: boolean;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare totalScans: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare uniqueUsers: number;

  @HasMany(() => QRScan)
  declare scans: QRScan[];
}
