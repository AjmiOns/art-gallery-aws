import {
  BadRequestException, ConflictException, HttpException, Injectable, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Artwork } from '../artworks/artwork.entity';
import { AuthUser } from '../common/current-user.decorator';
import { brandOf, CardInput, DECLINED, validateCard } from '../payments/card';
import { PaymentsService } from '../payments/payments.service';
import { User } from '../users/user.entity';
import { Subscription } from './subscription.entity';
import {
  addMonths, Billing, effectivePlan, effectivePlanId, isPlanId, PAID_PLANS, PLANS, planRank, priceOf, round2,
} from './plans';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly payments: PaymentsService,
    @InjectRepository(Subscription) private readonly subs: Repository<Subscription>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Artwork) private readonly artworks: Repository<Artwork>,
  ) {}

  // Catalogue public (page « Tarifs »)
  catalog() {
    return {
      currency: this.payments.currency.toUpperCase(),
      plans: Object.values(PLANS),
    };
  }

  // Nombre d'œuvres qui comptent dans la limite du plan : les œuvres vendues ne sont plus « en ligne ».
  countOnline(userId: string) {
    return this.artworks
      .createQueryBuilder('a')
      .where('a.ownerId = :userId', { userId })
      .andWhere("a.status IN ('available', 'reserved')")
      .getCount();
  }

  // État de l'abonnement de l'artiste, ses quotas et ses chiffres de vente (brut, commission, net)
  async me(user: AuthUser) {
    const u = await this.users.findOne({ where: { id: user.userId } });
    if (!u) throw new NotFoundException('Utilisateur introuvable.');
    const plan = effectivePlan(u);
    const expired = u.plan !== 'free' && plan.id === 'free';
    const [online, sales, history] = await Promise.all([
      this.countOnline(u.id),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS count,
                COALESCE(SUM(amount), 0)::float AS gross,
                COALESCE(SUM(commission_amount), 0)::float AS commission,
                COALESCE(SUM(net_amount), 0)::float AS net
         FROM orders WHERE seller_id = $1 AND status = 'paid'`,
        [u.id],
      ),
      this.subs.find({ where: { userId: u.id, status: 'succeeded' }, order: { paidAt: 'DESC' }, take: 20 }),
    ]);
    const [s] = sales;
    return {
      plan,
      billing: plan.id === 'free' ? null : u.planBilling,
      expiresAt: plan.id === 'free' ? null : u.planExpiresAt,
      expired,
      usage: { online, max: plan.maxArtworks },
      sales: s,
      history,
    };
  }

  // 1. Démarre l'achat d'un abonnement
  async checkout(user: AuthUser, planId: string, billing: Billing) {
    if (!isPlanId(planId) || !PAID_PLANS.includes(planId)) throw new BadRequestException('Abonnement inconnu.');
    const u = await this.users.findOne({ where: { id: user.userId } });
    if (!u) throw new NotFoundException('Utilisateur introuvable.');
    const current = effectivePlanId(u);
    if (planRank(planId) < planRank(current)) {
      throw new BadRequestException("Vous avez déjà un abonnement supérieur : il restera actif jusqu'à sa date de fin.");
    }
    const def = PLANS[planId];
    const provider = this.payments.provider;
    const currency = this.payments.currency;
    const amount = priceOf(def, billing);

    // Un nouvel essai réutilise la tentative en cours plutôt que d'en créer une nouvelle.
    let sub = await this.subs.findOne({ where: { userId: u.id, plan: planId, billing, provider, status: 'pending' } });
    if (sub) {
      sub.amount = amount;
      sub.currency = currency;
      sub = await this.subs.save(sub);
    } else {
      sub = await this.subs.save(this.subs.create({ userId: u.id, plan: planId, billing, amount, currency, provider }));
    }
    if (provider === 'mock') return { provider, subscriptionId: sub.id, amount, currency, plan: planId, billing };

    const front = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').split(',')[0];
    const session = await this.payments.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: Math.round(amount * 100),
          product_data: { name: `Abonnement ${def.name} (${billing === 'yearly' ? 'annuel' : 'mensuel'})` },
        },
      }],
      client_reference_id: sub.id,
      metadata: { subscriptionId: sub.id },
      success_url: `${front}/subscribe?plan=${planId}&billing=${billing}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${front}/subscribe?plan=${planId}&billing=${billing}&cancelled=1`,
    });
    await this.subs.update(sub.id, { providerRef: session.id });
    return { provider, subscriptionId: sub.id, url: session.url, plan: planId, billing };
  }

  // 2a. Paiement par carte de la passerelle de démonstration (aucun débit)
  async confirmMock(user: AuthUser, subscriptionId: string, card: CardInput) {
    const sub = await this.ownSubscription(user, subscriptionId);
    if (sub.provider !== 'mock') throw new BadRequestException('Ce paiement ne passe pas par la passerelle de démonstration.');
    if (sub.status === 'succeeded') return this.receipt(sub.id);

    const number = validateCard(card);
    await new Promise((r) => setTimeout(r, 900)); // latence réaliste de la banque
    if (DECLINED[number]) {
      await this.subs.update(sub.id, { status: 'failed', failureReason: DECLINED[number], cardLast4: number.slice(-4), cardBrand: brandOf(number) });
      throw new HttpException(DECLINED[number], 402);
    }
    await this.activate(sub.id, { brand: brandOf(number), last4: number.slice(-4) });
    return this.receipt(sub.id);
  }

  // 2b. Retour de Stripe Checkout : on interroge Stripe, on ne se fie jamais à l'URL seule.
  async confirmStripe(user: AuthUser, sessionId: string) {
    if (this.payments.provider !== 'stripe') throw new BadRequestException("Stripe n'est pas activé.");
    const session = await this.payments.stripe.checkout.sessions.retrieve(sessionId);
    const sub = await this.ownSubscription(user, session.client_reference_id ?? '');
    if (session.payment_status !== 'paid') throw new HttpException('Paiement non finalisé.', 402);
    await this.activate(sub.id, null);
    return this.receipt(sub.id);
  }

  // Résilie : le compte repasse au plan gratuit tout de suite (pas de remboursement). Les œuvres déjà en ligne
  // restent visibles, mais aucune nouvelle œuvre ne peut être publiée tant que la limite du plan gratuit est dépassée.
  async cancel(user: AuthUser) {
    await this.users.update(user.userId, { plan: 'free', planBilling: null, planExpiresAt: null });
    return this.me(user);
  }

  private async ownSubscription(user: AuthUser, id: string) {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Abonnement introuvable.');
    if (sub.userId !== user.userId) throw new NotFoundException('Abonnement introuvable.');
    return sub;
  }

  // Paiement validé : abonnement marqué payé ET plan de l'artiste mis à jour, en une seule transaction.
  private async activate(subscriptionId: string, card: { brand: string; last4: string } | null) {
    await this.dataSource.transaction(async (m) => {
      const sub = await m.findOne(Subscription, { where: { id: subscriptionId }, lock: { mode: 'pessimistic_write' } });
      if (!sub || sub.status === 'succeeded') return;
      const user = await m.findOne(User, { where: { id: sub.userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw new ConflictException('Compte introuvable.');

      const now = new Date();
      const months = sub.billing === 'yearly' ? 12 : 1;
      // Renouvellement du même plan : la période s'ajoute à la fin de la période en cours.
      // Changement de plan (passage à un niveau supérieur) : la nouvelle période démarre maintenant.
      const sameActive = effectivePlanId(user, now) === sub.plan && user.planExpiresAt && new Date(user.planExpiresAt) > now;
      const startsAt = sameActive ? new Date(user.planExpiresAt as Date) : now;
      const endsAt = addMonths(startsAt, months);

      sub.status = 'succeeded';
      sub.paidAt = now;
      sub.startsAt = startsAt;
      sub.endsAt = endsAt;
      sub.failureReason = null;
      if (card) { sub.cardBrand = card.brand; sub.cardLast4 = card.last4; }
      user.plan = sub.plan;
      user.planBilling = sub.billing;
      user.planExpiresAt = endsAt;
      await m.save(sub);
      await m.save(user);
    });
  }

  private async receipt(id: string) {
    const sub = await this.subs.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Abonnement introuvable.');
    return {
      subscriptionId: sub.id,
      status: sub.status,
      plan: sub.plan,
      billing: sub.billing,
      amount: round2(sub.amount),
      currency: sub.currency,
      provider: sub.provider,
      cardBrand: sub.cardBrand,
      cardLast4: sub.cardLast4,
      startsAt: sub.startsAt,
      endsAt: sub.endsAt,
      paidAt: sub.paidAt,
    };
  }
}
