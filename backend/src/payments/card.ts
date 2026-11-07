import { BadRequestException } from '@nestjs/common';

export interface CardInput { cardNumber: string; expiry: string; cvc: string; holder: string }

// Cartes de test (comme chez Stripe) : 4242… réussit, les suivantes simulent un refus.
export const DECLINED: Record<string, string> = {
  '4000000000000002': 'Carte refusée par la banque.',
  '4000000000009995': 'Fonds insuffisants.',
  '4000000000000069': 'Carte expirée.',
};

export function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

export function brandOf(n: string) {
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'American Express';
  return 'Carte';
}

// Validation réaliste d'une carte de la passerelle de démonstration. Renvoie le numéro nettoyé.
export function validateCard(card: CardInput): string {
  const number = card.cardNumber.replace(/\s+/g, '');
  if (!/^\d{13,19}$/.test(number) || !luhn(number)) throw new BadRequestException('Numéro de carte invalide.');
  const [mm, yy] = card.expiry.split('/').map((x) => Number(x));
  const year = yy < 100 ? 2000 + yy : yy;
  if (!(mm >= 1 && mm <= 12) || new Date(year, mm, 1).getTime() <= Date.now()) {
    throw new BadRequestException("Date d'expiration invalide ou dépassée.");
  }
  if (!/^\d{3,4}$/.test(card.cvc)) throw new BadRequestException('Code de sécurité invalide.');
  if (card.holder.trim().length < 2) throw new BadRequestException('Nom du titulaire requis.');
  return number;
}
