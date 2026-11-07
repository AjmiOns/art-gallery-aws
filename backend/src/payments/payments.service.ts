import {
  BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { DataSource, Repository } from 'typeorm';
import { Artwork } from '../artworks/artwork.entity';
import { AuthUser } from '../common/current-user.decorator';
import { Order } from '../orders/order.entity';
import { commissionRateFor, round2 } from '../subscriptions/plans';
import { User } from '../users/user.entity';
import { brandOf, CardInput, DECLINED, validateCard } from './card';
import { Payment } from './payment.entity';

export type { CardInput };

@Injectable()
export class PaymentsService {
  private stripeClient: Stripe | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  // Sélection du prestataire : PAYMENT_PROVIDER=mock (défaut) ou stripe (clé de test requise)
  get provider(): 'mock' | 'stripe' {
    return this.config.get('PAYMENT_PROVIDER') === 'stripe' && this.config.get('STRIPE_SECRET_KEY') ? 'stripe' : 'mock';
  }

  get currency() {
    return this.provider === 'stripe'
      ? (this.config.get<string>('STRIPE_CURRENCY') ?? 'eur').toLowerCase()
      : (this.config.get<string>('CURRENCY') ?? 'TND').toUpperCase();
  }

  info() {
    return { provider: this.provider, currency: this.currency, testMode: true };
  }

  // Partagé avec le module d'abonnements
  get stripe() {
    if (!this.stripeClient) this.stripeClient = new Stripe(this.config.getOrThrow<string>('STRIPE_SECRET_KEY'));
    return this.stripeClient;
  }

  // Démarre le paiement d'une commande acceptée par l'artiste
  async checkout(user: AuthUser, orderId: string) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable.');
    if (order.buyerId !== user.userId) throw new ForbiddenException("Seul l'acheteur peut payer cette commande.");
    if (order.status !== 'accepted') {
      throw new BadRequestException("La demande doit d'abord être acceptée par l'artiste.");
    }
    let payment = await this.payments.findOne({ where: { orderId, provider: this.provider, status: 'pending' } });
    if (!payment) {
      payment = await this.payments.save(
        this.payments.create({ orderId, provider: this.provider, amount: order.amount, currency: this.currency }),
      );
    }
    if (this.provider === 'mock') {
      return { provider: 'mock', paymentId: payment.id, amount: payment.amount, currency: payment.currency };
    }
    const artwork = await this.dataSource.getRepository(Artwork).findOne({ where: { id: order.artworkId } });
    const front = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').split(',')[0];
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: payment.currency,
          unit_amount: Math.round(Number(payment.amount) * 100),
          product_data: { name: artwork?.title ?? 'Œuvre' },
        },
      }],
      client_reference_id: payment.id,
      metadata: { paymentId: payment.id, orderId },
      success_url: `${front}/checkout?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${front}/checkout?order=${orderId}&cancelled=1`,
    });
    await this.payments.update(payment.id, { providerRef: session.id });
    return { provider: 'stripe', paymentId: payment.id, url: session.url };
  }

  // Paiement par carte de la passerelle de démonstration (validation réaliste, aucun débit)
  async confirmMock(user: AuthUser, paymentId: string, card: CardInput) {
    const payment = await this.ownPayment(user, paymentId);
    if (payment.provider !== 'mock') throw new BadRequestException('Ce paiement ne passe pas par la passerelle de démonstration.');
    if (payment.status === 'succeeded') return this.receipt(payment.id);

    const number = validateCard(card);

    await new Promise((r) => setTimeout(r, 900)); // latence réaliste de la banque
    if (DECLINED[number]) {
      await this.payments.update(payment.id, { status: 'failed', failureReason: DECLINED[number], cardLast4: number.slice(-4), cardBrand: brandOf(number) });
      // Le paiement échoué est clos : un nouvel essai créera un nouveau paiement.
      throw new HttpException(DECLINED[number], 402);
    }
    await this.finalize(payment.id, { brand: brandOf(number), last4: number.slice(-4) });
    return this.receipt(payment.id);
  }

  // Retour de Stripe Checkout : on interroge Stripe, on ne se fie jamais à l'URL seule.
  async confirmStripe(user: AuthUser, sessionId: string) {
    if (this.provider !== 'stripe') throw new BadRequestException('Stripe n\'est pas activé.');
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    const payment = await this.ownPayment(user, session.client_reference_id ?? '');
    if (session.payment_status !== 'paid') throw new HttpException('Paiement non finalisé.', 402);
    await this.finalize(payment.id, null);
    return this.receipt(payment.id);
  }

  private async ownPayment(user: AuthUser, paymentId: string) {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Paiement introuvable.');
    const order = await this.orders.findOne({ where: { id: payment.orderId } });
    if (order?.buyerId !== user.userId) throw new ForbiddenException("Ce paiement ne vous concerne pas.");
    return payment;
  }

  // Paiement validé : commande payée ET œuvre vendue, en une seule transaction.
  private async finalize(paymentId: string, card: { brand: string; last4: string } | null) {
    await this.dataSource.transaction(async (m) => {
      const payment = await m.findOne(Payment, { where: { id: paymentId }, lock: { mode: 'pessimistic_write' } });
      if (!payment || payment.status === 'succeeded') return;
      const order = await m.findOne(Order, { where: { id: payment.orderId }, lock: { mode: 'pessimistic_write' } });
      const artwork = await m.findOne(Artwork, { where: { id: order.artworkId }, lock: { mode: 'pessimistic_write' } });
      if (order.status !== 'accepted' || artwork.status !== 'reserved') {
        throw new ConflictException("Cette commande n'est plus payable.");
      }
      const now = new Date();
      payment.status = 'succeeded';
      payment.paidAt = now;
      payment.failureReason = null;
      if (card) { payment.cardBrand = card.brand; payment.cardLast4 = card.last4; }
      order.status = 'paid';
      order.paidAt = now;
      // Commission de la plateforme : le taux dépend du plan de l'artiste au moment du paiement, puis il est figé.
      const seller = await m.findOne(User, { where: { id: order.sellerId } });
      const rate = commissionRateFor(seller, now);
      order.commissionRate = rate;
      order.commissionAmount = round2(Number(order.amount) * rate);
      order.netAmount = round2(Number(order.amount) - order.commissionAmount);
      artwork.status = 'sold';
      await m.save(payment);
      await m.save(order);
      await m.save(artwork);
    });
  }

  private async receipt(paymentId: string) {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      cardBrand: payment.cardBrand,
      cardLast4: payment.cardLast4,
      paidAt: payment.paidAt,
    };
  }
}
