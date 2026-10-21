import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCategoryDto, UpdateCategoryDto } from '../categories/category.dto';
import { CategoriesService } from '../categories/categories.service';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles, RolesGuard } from '../common/roles';
import { OrdersService } from '../orders/orders.service';
import { AdminUpdateUserDto } from '../users/dto/profile.dto';
import { UsersService } from '../users/users.service';
import { AdminService } from './admin.service';

// Toutes les routes /api/admin/* sont réservées au rôle admin.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly users: UsersService,
    private readonly categories: CategoriesService,
    private readonly orders: OrdersService,
  ) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  listUsers(@Query('role') role?: string, @Query('q') q?: string, @Query('status') status?: string) {
    return this.users.adminList({ role, q, status });
  }

  @Patch('users/:id')
  updateUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.adminUpdate(id, dto, actor.userId);
  }

  @Delete('users/:id')
  removeUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.users.adminRemove(id, actor.userId);
  }

  @Get('orders')
  listOrders(@Query('status') status?: string) {
    return this.orders.adminList(status);
  }

  @Get('categories')
  listCategories() {
    return this.categories.findAll();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }
}
