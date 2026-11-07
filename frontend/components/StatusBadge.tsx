'use client';

import type { ArtworkStatus, OrderStatus } from '@/lib/api';
import { useI18n } from './LanguageProvider';

const LABELS: Record<OrderStatus | ArtworkStatus, string> = {
  pending: 'En attente',
  accepted: 'Acceptée, à payer',
  rejected: 'Refusée',
  cancelled: 'Annulée',
  paid: 'Payée',
  available: 'Disponible',
  reserved: 'Réservée',
  sold: 'Vendue',
};

export default function StatusBadge({ status }: { status: OrderStatus | ArtworkStatus }) {
  const { t } = useI18n();
  return <span className={`status status--${status}`}>{t(LABELS[status])}</span>;
}
