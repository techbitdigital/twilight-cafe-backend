import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Order } from './order.entity';

@Table({ tableName: 'order_items', timestamps: true })
export class OrderItem extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => Order)
  @Column({ type: DataType.UUID })
  declare orderId: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare menuItemId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare itemName: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare quantity: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare price: number;

  @Column({ type: DataType.JSON })
  declare selectedVariation: any;

  @Column({ type: DataType.JSON })
  declare selectedAddons: any[];

  @BelongsTo(() => Order)
  declare order: Order;
}
