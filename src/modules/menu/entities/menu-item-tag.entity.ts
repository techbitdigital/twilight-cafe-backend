import {
  Table,
  Column,
  Model,
  ForeignKey,
  DataType,
} from 'sequelize-typescript';
import { MenuItem } from './menu-item.entity';
import { ItemTag } from './item-tag.entity';

@Table({ tableName: 'menu_item_tags_junction', timestamps: false })
export class MenuItemTag extends Model {
  @ForeignKey(() => MenuItem)
  @Column({ type: DataType.UUID })
  menuItemId: string;

  @ForeignKey(() => ItemTag)
  @Column({ type: DataType.UUID })
  itemTagId: string;
}
