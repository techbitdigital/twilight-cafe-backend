import { Table, Column, Model, DataType, HasMany } from "sequelize-typescript";
import type { CreationOptional } from "sequelize";
import { Order } from "../modules/orders/entities/order.entity";

export interface DeliveryInfo {
  streetAddress: string;
  apartmentNumber: string;
  instructions?: string;
}

export interface NotificationPrefs {
  newOrders?: boolean;
  lowStock?: boolean;
  emailSummary?: boolean;
}

export interface UserAttributes {
  id?: number;
  email: string;
  fullName?: string;
  phone?: string;
  password?: string;
  role?: "customer" | "admin";
  hasPassword?: boolean;
  notificationPrefs?: NotificationPrefs | null;
  deliveryInfo?: DeliveryInfo;
}

@Table({ tableName: "users", timestamps: true })
export class User
  extends Model<User, UserAttributes>
  implements UserAttributes
{
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: CreationOptional<number>;

  @Column({ unique: true, allowNull: false })
  declare email: string;

  @Column({ allowNull: true })
  declare fullName?: string;

  @Column({ allowNull: true })
  declare phone?: string;

  @Column({ allowNull: true })
  declare password?: string;

  @Column({
    type: DataType.ENUM("customer", "admin"),
    defaultValue: "customer",
    allowNull: false,
  })
  declare role: CreationOptional<"customer" | "admin">;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  })
  declare hasPassword: CreationOptional<boolean>;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    defaultValue: null,
  })
  declare notificationPrefs: NotificationPrefs | null;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  declare deliveryInfo?: DeliveryInfo;

  @HasMany(() => Order)
  declare orders?: Order[];
}
