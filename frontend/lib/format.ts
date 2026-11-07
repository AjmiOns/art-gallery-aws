import { CURRENCY } from './api';

export const formatPrice = (price: number, currency = CURRENCY) =>
  `${Number(price).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// 0.08 -> « 8 % », 0.125 -> « 12,5 % »
export const formatPercent = (rate: number) =>
  `${(rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
