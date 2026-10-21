import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles, RolesGuard } from '../common/roles';
import { OrdersService } from './orders.service';

class CreateOrderDto {
  @IsUUID()
  artworkId: string;

  @IsOptional() @IsString() @MaxLength(500)
  message?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // Demande d'achat (les administrateurs n'achètent pas)
  @Roles('buyer', 'artist')
  @Post()
  request(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.request(user, dto.artworkId, dto.message);
  }

  @Get('bought')
  bought(@CurrentUser() user: AuthUser) {
    return this.orders.listBought(user.userId);
  }

  @Roles('artist', 'admin')
  @Get('sales')
  sales(@CurrentUser() user: AuthUser) {
    return this.orders.listSales(user.userId);
  }

  @Get(':id')
  one(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.orders.getOne(id, user);
  }

  @Roles('artist', 'admin')
  @Patch(':id/accept')
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.orders.accept(id, user);
  }

  @Roles('artist', 'admin')
  @Patch(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.orders.reject(id, user);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.orders.cancel(id, user);
  }
}
