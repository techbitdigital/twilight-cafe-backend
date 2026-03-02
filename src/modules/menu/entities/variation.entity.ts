import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { MenuItem } from './menu-item.entity';

@Table({ tableName: 'variations', timestamps: true })
export class Variation extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => MenuItem)
  @Column({ type: DataType.UUID })
  declare menuItemId: string;

  @BelongsTo(() => MenuItem)
  declare menuItem: MenuItem;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  declare priceAdjustment: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  declare isAvailable: boolean;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare sortOrder: number;
}
