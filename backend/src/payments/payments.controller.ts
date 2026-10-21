import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { PaymentsService } from './payments.service';

class CheckoutDto {
  @IsUUID()
  orderId: string;
}

class MockConfirmDto {
  @IsUUID() paymentId: string;
  @IsString() @MaxLength(32) cardNumber: string;
  @IsString() @MaxLength(7) expiry: string;
  @IsString() @MaxLength(4) cvc: string;
  @IsString() @MaxLength(80) holder: string;
}

class StripeConfirmDto {
  @IsString() @MaxLength(200) sessionId: string;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // Public : l'interface choisit le formulaire de paiement selon le prestataire actif
  @Get('config')
  config() {
    return this.payments.info();
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.payments.checkout(user, dto.orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mock/confirm')
  confirmMock(@CurrentUser() user: AuthUser, @Body() dto: MockConfirmDto) {
    return this.payments.confirmMock(user, dto.paymentId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('stripe/confirm')
  confirmStripe(@CurrentUser() user: AuthUser, @Body() dto: StripeConfirmDto) {
    return this.payments.confirmStripe(user, dto.sessionId);
  }
}
