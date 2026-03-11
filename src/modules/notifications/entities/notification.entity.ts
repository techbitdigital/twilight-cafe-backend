import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { User } from "../../../users/user.model";

export type NotificationType = "order" | "stock" | "system" | "summary";

@Table({ tableName: "notifications", timestamps: true })
export class Notification extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare userId: number;

  @Column({
    type: DataType.ENUM("order", "stock", "system", "summary"),
    allowNull: false,
  })
  declare type: NotificationType;

  @Column({ type: DataType.STRING, allowNull: false })
  declare title: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare message: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare isRead: boolean;

  @Column({ type: DataType.JSON, allowNull: true })
  declare meta: Record<string, unknown> | null;

  // ✅ FIX: Explicitly declare timestamps so TypeScript knows about them
  // Without these, toResult() in the service would throw a TS error on n.createdAt
  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @BelongsTo(() => User)
  declare user: User;
}
