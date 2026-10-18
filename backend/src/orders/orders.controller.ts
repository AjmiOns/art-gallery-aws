import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { OrdersService } from './orders.service';

class CreateOrderDto {
  @IsUUID()
  artworkId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  buy(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.buy(dto.artworkId, user.userId);
  }

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.findMine(user.userId);
  }
}
