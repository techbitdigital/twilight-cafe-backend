/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, WhereOptions, Sequelize } from "sequelize";
import { MenuItem } from "./entities/menu-item.entity";
import { Category } from "./entities/category.entity";
import { Variation } from "./entities/variation.entity";
import { Addon } from "./entities/addon.entity";
import { CreateMenuItemDto } from "./dto/create-menu-item.dto";

/**
 * Strongly typed filters for menu items
 */
export interface MenuItemFilters {
  categoryId?: string;
  status?: string;
  search?: string;
}

@Injectable()
export class MenuService {
  constructor(
    @InjectModel(MenuItem)
    private readonly menuItemModel: typeof MenuItem,

    @InjectModel(Category)
    private readonly categoryModel: typeof Category,

    @InjectModel(Variation)
    private readonly variationModel: typeof Variation,

    @InjectModel(Addon)
    private readonly addonModel: typeof Addon,
  ) {}

  // =========================
  // Categories
  // =========================

  async createCategory(name: string, description?: string, icon?: string) {
    // ⭐ 1. Validate input
    if (!name || name.trim() === "") {
      throw new BadRequestException("Category name is required");
    }

    // ⭐ 2. Check if category already exists
    const existingCategory = await this.categoryModel.findOne({
      where: { name: name.trim() },
    });

    if (existingCategory) {
      throw new ConflictException(
        `Category with name "${name}" already exists`,
      );
    }

    // ⭐ 3. Create with try-catch for any other DB errors
    try {
      return await this.categoryModel.create({
        name: name.trim(),
        description: description?.trim(),
        icon,
      });
    } catch (error) {
      // Handle any unexpected errors
      if (error.name === "SequelizeUniqueConstraintError") {
        throw new ConflictException(
          `Category with name "${name}" already exists`,
        );
      }
      throw new BadRequestException("Failed to create category");
    }
  }

  async getAllCategories() {
    return this.categoryModel.findAll({
      where: { isActive: true },
      order: [
        ["sortOrder", "ASC"],
        ["name", "ASC"],
      ],
    });
  }

  async getCategory(id: string) {
    const category = await this.categoryModel.findByPk(id, {
      include: [
        {
          model: MenuItem,
          where: { status: "published" },
          required: false,
        },
      ],
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return category;
  }

  // ⭐ Add update category method
  async updateCategory(
    id: string,
    name?: string,
    description?: string,
    icon?: string,
  ) {
    const category = await this.categoryModel.findByPk(id);

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    // Check if new name conflicts with existing category
    if (name && name !== category.name) {
      const existingCategory = await this.categoryModel.findOne({
        where: {
          name: name.trim(),
          id: { [Op.ne]: id }, // Exclude current category
        },
      });

      if (existingCategory) {
        throw new ConflictException(
          `Category with name "${name}" already exists`,
        );
      }
    }

    try {
      await category.update({
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
        ...(icon !== undefined && { icon }),
      });

      return category;
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        throw new ConflictException(
          `Category with name "${name}" already exists`,
        );
      }
      throw new BadRequestException("Failed to update category");
    }
  }

  // ⭐ Add delete category method
  async deleteCategory(id: string) {
    const category = await this.categoryModel.findByPk(id);

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    // Check if category has menu items
    const menuItemCount = await this.menuItemModel.count({
      where: { categoryId: id },
    });

    if (menuItemCount > 0) {
      throw new BadRequestException(
        `Cannot delete category. It has ${menuItemCount} menu item(s) associated with it.`,
      );
    }

    await category.destroy();
    return { message: "Category deleted successfully" };
  }

  // =========================
  // Menu Items
  // =========================

  async createMenuItem(createMenuItemDto: CreateMenuItemDto, images: string[]) {
    const category = await this.categoryModel.findByPk(
      createMenuItemDto.categoryId,
    );
    if (!category) throw new NotFoundException("Category not found");

    const existingItem = await this.menuItemModel.findOne({
      where: { name: createMenuItemDto.name.trim() },
    });
    if (existingItem) {
      throw new ConflictException(
        `Menu item with name "${createMenuItemDto.name}" already exists`,
      );
    }

    try {
      const menuItem = await this.menuItemModel.create({
        ...createMenuItemDto,
        name: createMenuItemDto.name.trim(),
        images,
      });

      if (createMenuItemDto.variations?.length) {
        const variations = createMenuItemDto.variations.map(
          (variation, index) => ({
            ...variation,
            menuItemId: menuItem.id,
            sortOrder: index,
          }),
        );
        await this.variationModel.bulkCreate(variations);
      }

      if (createMenuItemDto.addons?.length) {
        const addons = createMenuItemDto.addons.map((addon, index) => ({
          ...addon,
          menuItemId: menuItem.id,
          sortOrder: index,
        }));
        await this.addonModel.bulkCreate(addons);
      }

      return this.getMenuItem(menuItem.id);
    } catch (error) {
      // ✅ Re-throw NestJS HTTP exceptions as-is — don't swallow them
      if (error?.status) throw error;

      if (error.name === "SequelizeUniqueConstraintError") {
        throw new ConflictException(
          `Menu item with name "${createMenuItemDto.name}" already exists`,
        );
      }

      throw new BadRequestException("Failed to create menu item");
    }
  }

  async getMenuItem(id: string) {
    const menuItem = await this.menuItemModel.findByPk(id, {
      include: [{ model: Category }, { model: Variation }, { model: Addon }],
    });

    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }

    return menuItem;
  }

  async getAllMenuItems(filters?: MenuItemFilters) {
    const where: WhereOptions<MenuItem> = {};

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${filters.search}%` } },
        { description: { [Op.like]: `%${filters.search}%` } },
      ];
    }

    return this.menuItemModel.findAll({
      where,
      include: [{ model: Category }, { model: Variation }, { model: Addon }],
      order: [["createdAt", "DESC"]],
    });
  }

  async updateMenuItem(id: string, updateData: any, images?: string[]) {
    const menuItem = await this.menuItemModel.findByPk(id);
    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }

    const updatePayload: any = {};

    if (updateData.name !== undefined)
      updatePayload.name = updateData.name.trim();

    if (updateData.description !== undefined)
      updatePayload.description = updateData.description;

    if (updateData.categoryId !== undefined)
      updatePayload.categoryId = updateData.categoryId;

    if (updateData.regularPrice !== undefined)
      updatePayload.regularPrice = updateData.regularPrice;

    if (updateData.salePrice !== undefined)
      updatePayload.salePrice = updateData.salePrice;

    if (typeof updateData.isAvailableForOrdering === "boolean") {
      updatePayload.isAvailableForOrdering = updateData.isAvailableForOrdering;
    }

    if (updateData.preparationTime !== undefined)
      updatePayload.preparationTime = updateData.preparationTime;

    if (updateData.status !== undefined)
      updatePayload.status = updateData.status;

    if (typeof updateData.trackInventory === "boolean") {
      updatePayload.trackInventory = updateData.trackInventory;
    }

    if (updateData.stockQuantity !== undefined)
      updatePayload.stockQuantity = updateData.stockQuantity;

    if (updateData.lowStockAlert !== undefined)
      updatePayload.lowStockAlert = updateData.lowStockAlert;

    if (updateData.tags !== undefined) updatePayload.tags = updateData.tags;

    if (images?.length) {
      updatePayload.images = images;
    }

    await menuItem.update(updatePayload);

    return this.getMenuItem(id);
  }

  async toggleMenuItemAvailability(id: string) {
    const menuItem = await this.menuItemModel.findByPk(id);

    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }

    await menuItem.update({
      isAvailableForOrdering: !menuItem.isAvailableForOrdering,
    });

    return menuItem;
  }

  async deleteMenuItem(id: string) {
    const menuItem = await this.menuItemModel.findByPk(id);

    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }

    await menuItem.destroy();
    return { message: "Menu item deleted successfully" };
  }

  async updateStock(id: string, quantity: number) {
    const menuItem = await this.menuItemModel.findByPk(id);

    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }

    if (menuItem.trackInventory !== true) {
      throw new BadRequestException(
        "Inventory tracking is not enabled for this item",
      );
    }

    await menuItem.update({ stockQuantity: quantity });
    return menuItem;
  }

  async checkLowStock() {
    return this.menuItemModel.findAll({
      where: {
        trackInventory: 1,
        [Op.and]: Sequelize.where(
          Sequelize.col("stockQuantity"),
          Op.lte,
          Sequelize.col("lowStockAlert"),
        ),
      },
    });
  }
}
