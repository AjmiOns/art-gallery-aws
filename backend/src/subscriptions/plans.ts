// Catalogue des abonnements artiste et règles de commission.
// Fichier volontairement sans dépendance : il est importé par les modules users, artworks, payments et subscriptions.
// Pour changer un prix, un taux ou une limite, modifiez uniquement ce fichier.

export type PlanId = 'free' | 'premium' | 'pro';
export type Billing = 'monthly' | 'yearly';

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  // Prix dans la devise de la plateforme (CURRENCY)
  monthlyPrice: number;
  // Tarif annuel : deux mois offerts
  yearlyPrice: number;
  // Part du prix de vente prélevée par la plateforme (0.15 = 15 %)
  commissionRate: number;
  // Nombre maximal d'œuvres en ligne (disponibles ou réservées). null = illimité
  maxArtworks: number | null;
  perks: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: 'free',
    name: 'Gratuit',
    tagline: 'Pour publier vos premières œuvres',
    monthlyPrice: 0,
    yearlyPrice: 0,
    commissionRate: 0.15,
    maxArtworks: 10,
    perks: ['10 œuvres en ligne', 'Commission de 15 % par vente', 'Messagerie avec les acheteurs'],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    tagline: 'Pour les artistes qui vendent régulièrement',
    monthlyPrice: 29,
    yearlyPrice: 290,
    commissionRate: 0.08,
    maxArtworks: 50,
    perks: [
      '50 œuvres en ligne',
      'Commission réduite à 8 % par vente',
      'Badge Premium sur vos œuvres',
      'Vos œuvres passent en tête du catalogue',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Pour les galeries et les artistes à plein temps',
    monthlyPrice: 79,
    yearlyPrice: 790,
    commissionRate: 0.03,
    maxArtworks: null,
    perks: [
      'Œuvres illimitées',
      'Commission minimale de 3 % par vente',
      'Badge Pro sur vos œuvres',
      'Vos œuvres passent en tête du catalogue',
    ],
  },
};

export const PAID_PLANS: PlanId[] = ['premium', 'pro'];
const RANK: Record<PlanId, number> = { free: 0, premium: 1, pro: 2 };

export const planRank = (id: PlanId) => RANK[id];
export const isPlanId = (v: unknown): v is PlanId => typeof v === 'string' && v in PLANS;

type PlanHolder = { plan?: PlanId | null; planExpiresAt?: Date | string | null };

// Un abonnement payant n'est valable que jusqu'à sa date de fin : passé ce jour, le compte retombe au plan gratuit.
export function effectivePlanId(user: PlanHolder | null | undefined, now = new Date()): PlanId {
  if (!user?.plan || user.plan === 'free' || !isPlanId(user.plan) || !user.planExpiresAt) return 'free';
  return new Date(user.planExpiresAt).getTime() > now.getTime() ? user.plan : 'free';
}

export const effectivePlan = (user: PlanHolder | null | undefined, now = new Date()) => PLANS[effectivePlanId(user, now)];

export const commissionRateFor = (user: PlanHolder | null | undefined, now = new Date()) =>
  effectivePlan(user, now).commissionRate;

export const priceOf = (plan: PlanDef, billing: Billing) => (billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice);

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Ajoute des mois en gardant le jour du mois quand c'est possible (31 janvier + 1 mois = 28 février).
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}
