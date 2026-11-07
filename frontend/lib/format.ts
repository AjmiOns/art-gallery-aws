import { CURRENCY } from './api';
import { getActiveLang, LOCALES } from './i18n';

// Les formats suivent la langue active de la plateforme (français ou anglais).
const loc = () => LOCALES[getActiveLang()];

export const formatPrice = (price: number, currency = CURRENCY) =>
  `${Number(price).toLocaleString(loc(), { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(loc(), { day: 'numeric', month: 'long', year: 'numeric' });

export const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: '2-digit' });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(loc(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// 0.08 -> « 8 % » (fr) ou « 8% » (en)
export const formatPercent = (rate: number) => {
  const n = (rate * 100).toLocaleString(loc(), { maximumFractionDigits: 1 });
  return getActiveLang() === 'fr' ? `${n} %` : `${n}%`;
};
