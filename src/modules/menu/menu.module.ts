import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { MenuItem } from './entities/menu-item.entity';
import { Category } from './entities/category.entity';
import { Variation } from './entities/variation.entity';
import { Addon } from './entities/addon.entity';
import { MenuItemTag } from './entities/menu-item-tag.entity';
import { ItemTag } from './entities/item-tag.entity';

@Module({
  imports: [
    SequelizeModule.forFeature([
      MenuItem,
      Category,
      Variation,
      Addon,
      ItemTag,
      MenuItemTag,
    ]),
  ],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
