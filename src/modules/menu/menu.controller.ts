import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MenuService } from './menu.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Auth & RBAC
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { Express } from 'express';

@Controller('api/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // =========================
  // PUBLIC ENDPOINTS
  // =========================

  // Categories (public)
  @Get('categories')
  async getAllCategories() {
    return this.menuService.getAllCategories();
  }

  @Get('categories/:id')
  async getCategory(@Param('id') id: string) {
    return this.menuService.getCategory(id);
  }

  // Menu Items (public)
  @Get('items')
  async getAllMenuItems(@Query() filters: any) {
    return this.menuService.getAllMenuItems(filters);
  }

  @Get('items/:id')
  async getMenuItem(@Param('id') id: string) {
    return this.menuService.getMenuItem(id);
  }

  // =========================
  // ADMIN ONLY ENDPOINTS
  // =========================

  // Categories
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('categories')
  async createCategory(
    @Body() body: { name: string; description?: string; icon?: string },
  ) {
    return this.menuService.createCategory(
      body.name,
      body.description,
      body.icon,
    );
  }

  // Add these methods to your controller

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; icon?: string },
  ) {
    return this.menuService.updateCategory(
      id,
      body.name,
      body.description,
      body.icon,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    return this.menuService.deleteCategory(id);
  }

  // Menu Items
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('items')
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: diskStorage({
        destination: './uploads/menu-items',
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async createMenuItem(
    @Body() createMenuItemDto: CreateMenuItemDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const images = files
      ? files.map((file) => `/uploads/menu-items/${file.filename}`)
      : [];

    return this.menuService.createMenuItem(createMenuItemDto, images);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put('items/:id')
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: diskStorage({
        destination: './uploads/menu-items',
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async updateMenuItem(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateMenuItemDto>,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const images =
      files && files.length > 0
        ? files.map((file) => `/uploads/menu-items/${file.filename}`)
        : undefined;

    return this.menuService.updateMenuItem(id, updateData, images);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('items/:id')
  async deleteMenuItem(@Param('id') id: string) {
    return this.menuService.deleteMenuItem(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put('items/:id/stock')
  async updateStock(
    @Param('id') id: string,
    @Body() body: { quantity: number },
  ) {
    return this.menuService.updateStock(id, body.quantity);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('items/low-stock/alert')
  async checkLowStock() {
    return this.menuService.checkLowStock();
  }
}
