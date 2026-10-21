import type { ArtworkStatus, OrderStatus } from '@/lib/api';

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
  return <span className={`status status--${status}`}>{LABELS[status]}</span>;
}
