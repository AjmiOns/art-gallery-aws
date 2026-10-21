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
import { Payment } from './payment.entity';

export interface CardInput { cardNumber: string; expiry: string; cvc: string; holder: string }

// Cartes de test (comme chez Stripe) : 4242… réussit, les suivantes simulent un refus.
const DECLINED: Record<string, string> = {
  '4000000000000002': 'Carte refusée par la banque.',
  '4000000000009995': 'Fonds insuffisants.',
  '4000000000000069': 'Carte expirée.',
};

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

function brandOf(n: string) {
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'American Express';
  return 'Carte';
}

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

  private get stripe() {
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

    const number = card.cardNumber.replace(/\s+/g, '');
    if (!/^\d{13,19}$/.test(number) || !luhn(number)) throw new BadRequestException('Numéro de carte invalide.');
    const [mm, yy] = card.expiry.split('/').map((x) => Number(x));
    const year = yy < 100 ? 2000 + yy : yy;
    if (!(mm >= 1 && mm <= 12) || new Date(year, mm, 1).getTime() <= Date.now()) {
      throw new BadRequestException("Date d'expiration invalide ou dépassée.");
    }
    if (!/^\d{3,4}$/.test(card.cvc)) throw new BadRequestException('Code de sécurité invalide.');
    if (card.holder.trim().length < 2) throw new BadRequestException('Nom du titulaire requis.');

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
