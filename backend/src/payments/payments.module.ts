import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artwork } from '../artworks/artwork.entity';
import { Order } from '../orders/order.entity';
import { Payment } from './payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Order, Artwork])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
