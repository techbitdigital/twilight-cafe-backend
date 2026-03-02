import {
  Table,
  Column,
  Model,
  DataType,
  BelongsToMany,
} from 'sequelize-typescript';
import { MenuItem } from './menu-item.entity';
import { MenuItemTag } from './menu-item-tag.entity';

@Table({ tableName: 'item_tags', timestamps: true })
export class ItemTag extends Model<ItemTag> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string; // "Spicy", "Vegan"

  @Column(DataType.STRING)
  colorCode?: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive: boolean;

  @BelongsToMany(() => MenuItem, () => MenuItemTag)
  menuItems: MenuItem[];
}
