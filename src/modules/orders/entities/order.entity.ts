import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { OrderItem } from './order-item.entity';
import { User } from '../../../users/user.model';
import type { DeliveryInfo } from '../../../users/user.model';
import type { OrderStatus } from '../order-status.type';


@Table({ tableName: 'orders', timestamps: true })
export class Order extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;
  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare userId?: number;

  @Column({ type: DataType.STRING, unique: true })
  declare orderNumber: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare customerName: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare customerPhone: string;

  @Column({
    type: DataType.ENUM(
      'pending_payment',
      'paid',
      'preparing',
      'ready',
      'completed',
      'cancelled',
      'rejected',
    ),
    defaultValue: 'pending_payment',
  })
  status: OrderStatus

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare subtotal: number;

  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  declare tax: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare total: number;

  @Column({ type: DataType.TEXT })
  declare specialInstructions: string;

  @Column({
    type: DataType.ENUM('direct'),
    defaultValue: 'direct',
  })
  declare orderSource: string;
@Column({ type: DataType.TEXT, allowNull: true })
declare rejectionReason: string | null;

@Column({ type: DataType.DATE, allowNull: true })
declare cancelledAt: Date | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare deliveryInfoSnapshot?: DeliveryInfo;
  @Column({ type: DataType.DATE })
  declare completedAt: Date;

  @HasMany(() => OrderItem)
  declare items: OrderItem[];

  @BelongsTo(() => User)
  declare user?: User;
}
