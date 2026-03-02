import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Category } from './category.entity';
import { Variation } from './variation.entity';
import { Addon } from './addon.entity';

@Table({ tableName: 'menu_items', timestamps: true })
export class MenuItem extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.TEXT })
  declare description: string;

  @Column({ type: DataType.JSON })
  declare images: string[];

  @ForeignKey(() => Category)
  @Column({ type: DataType.UUID })
  declare categoryId: string;

  @BelongsTo(() => Category)
  declare category: Category;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare regularPrice: number;

  @Column({ type: DataType.DECIMAL(10, 2) })
  declare salePrice: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  declare isAvailableForOrdering: boolean;

  @Column({ type: DataType.INTEGER, defaultValue: 15 })
  declare preparationTime: number;

  @Column({ type: DataType.JSON })
  declare tags: string[];

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare trackInventory: boolean;

  @Column({ type: DataType.INTEGER })
  declare stockQuantity: number;

  @Column({ type: DataType.INTEGER, defaultValue: 5 })
  declare lowStockAlert: number;

  @Column({ type: DataType.ENUM('draft', 'published'), defaultValue: 'draft' })
  declare status: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  declare totalOrders: number;

  @HasMany(() => Variation)
  declare variations: Variation[];

  @HasMany(() => Addon)
  declare addons: Addon[];
}
