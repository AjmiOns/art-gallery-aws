'use client';

import { useI18n } from './LanguageProvider';
import CardPreview from './CardPreview';

export type CardValues = { cardNumber: string; holder: string; expiry: string; cvc: string };
export const EMPTY_CARD: CardValues = { cardNumber: '', holder: '', expiry: '', cvc: '' };

const groups4 = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const expiryFmt = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

// Champs de la carte de la passerelle de démonstration (aperçu + saisie formatée)
export default function CardFields({ value, onChange }: { value: CardValues; onChange: (v: CardValues) => void }) {
  const { t } = useI18n();
  return (
    <>
      <CardPreview number={value.cardNumber} holder={value.holder} expiry={value.expiry} />
      <label className="field"><span>{t('Numéro de carte')}</span><input required inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" value={value.cardNumber} onChange={(e) => onChange({ ...value, cardNumber: groups4(e.target.value) })} /></label>
      <label className="field"><span>{t('Nom du titulaire')}</span><input required autoComplete="cc-name" placeholder={t('Nom comme sur la carte')} value={value.holder} onChange={(e) => onChange({ ...value, holder: e.target.value.toUpperCase() })} /></label>
      <div className="form-grid">
        <label className="field"><span>{t('Expiration')}</span><input required inputMode="numeric" autoComplete="cc-exp" placeholder={t('MM/AA')} value={value.expiry} onChange={(e) => onChange({ ...value, expiry: expiryFmt(e.target.value) })} /></label>
        <label className="field"><span>{t('Code de sécurité')}</span><input required inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" maxLength={4} value={value.cvc} onChange={(e) => onChange({ ...value, cvc: e.target.value.replace(/\D/g, '') })} /></label>
      </div>
    </>
  );
}
