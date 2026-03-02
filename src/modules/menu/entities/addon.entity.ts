import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { MenuItem } from './menu-item.entity';

@Table({ tableName: 'addons', timestamps: true })
export class Addon extends Model {
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

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare price: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  declare isAvailable: boolean;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare sortOrder: number;
}
