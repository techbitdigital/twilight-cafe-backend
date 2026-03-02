import { Table, Column, Model, DataType, HasMany } from 'sequelize-typescript';
import { MenuItem } from './menu-item.entity';

@Table({ tableName: 'categories', timestamps: true })
export class Category extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.STRING })
  declare description: string;

  @Column({ type: DataType.STRING })
  declare icon: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare sortOrder: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  declare isActive: boolean;

  @HasMany(() => MenuItem)
  declare menuItems: MenuItem[];
}
