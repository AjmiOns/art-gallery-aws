import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles, RolesGuard } from '../common/roles';
import { SubscriptionsService } from './subscriptions.service';

class CheckoutDto {
  @IsIn(['premium', 'pro']) plan: string;
  @IsIn(['monthly', 'yearly']) billing: 'monthly' | 'yearly';
}

class MockConfirmDto {
  @IsUUID() subscriptionId: string;
  @IsString() @MaxLength(32) cardNumber: string;
  @IsString() @MaxLength(7) expiry: string;
  @IsString() @MaxLength(4) cvc: string;
  @IsString() @MaxLength(80) holder: string;
}

class StripeConfirmDto {
  @IsString() @MaxLength(200) sessionId: string;
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  // Public : la page « Tarifs » est visible avant de créer un compte
  @Get('plans')
  plans() {
    return this.subs.catalog();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.subs.me(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.subs.checkout(user, dto.plan, dto.billing);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Post('mock/confirm')
  confirmMock(@CurrentUser() user: AuthUser, @Body() dto: MockConfirmDto) {
    return this.subs.confirmMock(user, dto.subscriptionId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Post('stripe/confirm')
  confirmStripe(@CurrentUser() user: AuthUser, @Body() dto: StripeConfirmDto) {
    return this.subs.confirmStripe(user, dto.sessionId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Post('cancel')
  cancel(@CurrentUser() user: AuthUser) {
    return this.subs.cancel(user);
  }
}
