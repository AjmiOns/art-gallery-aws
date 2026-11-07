'use client';

import Link from 'next/link';
import type { Order } from '@/lib/api';
import { formatPercent, formatPrice, formatShortDate } from '@/lib/format';
import ArtImage from './ArtImage';
import { useI18n } from './LanguageProvider';
import StatusBadge from './StatusBadge';

type Props = {
  order: Order;
  perspective: 'buyer' | 'seller';
  busy?: boolean;
  onAction: (id: string, action: 'accept' | 'reject' | 'cancel') => void;
};

// Carte d'une demande d'achat, avec les actions possibles selon le point de vue (acheteur ou artiste)
export default function OrderCard({ order, perspective, busy, onAction }: Props) {
  const { t } = useI18n();
  const seller = perspective === 'seller';
  const other = seller ? order.buyer : order.seller;
  const contact = `/messages?to=${other.id}&artwork=${order.artwork.id}`;
  return (
    <article className="order">
      <div className="order__thumb"><ArtImage src={order.artwork.imageUrl} alt="" /></div>
      <div className="order__main">
        <h3>{order.artwork.title}</h3>
        <p className="muted">
          {seller ? t('Acheteur') : t('Artiste')} : <strong>{other.username}</strong> · {formatShortDate(order.createdAt)}
        </p>
        {seller && order.status === 'paid' && order.commissionAmount != null && (
          <p className="order__fees">
            {t('Commission {rate} : − {amount}', { rate: formatPercent(order.commissionRate ?? 0), amount: formatPrice(order.commissionAmount) })} · <strong>{t('Net perçu : {amount}', { amount: formatPrice(order.netAmount ?? order.amount) })}</strong>
          </p>
        )}
        {order.message && <blockquote className="order__note">« {order.message} »</blockquote>}
      </div>
      <div className="order__side">
        <span className="order__price">{formatPrice(order.amount)}</span>
        <StatusBadge status={order.status} />
        <div className="order__actions">
          {seller && order.status === 'pending' && (
            <>
              <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => onAction(order.id, 'accept')}>{t('Accepter')}</button>
              <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onAction(order.id, 'reject')}>{t('Refuser')}</button>
            </>
          )}
          {seller && order.status === 'accepted' && (
            <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onAction(order.id, 'cancel')}>{t('Annuler la réservation')}</button>
          )}
          {!seller && order.status === 'accepted' && (
            <>
              <Link href={`/checkout?order=${order.id}`} className="btn btn--primary btn--sm">{t('Payer')}</Link>
              <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onAction(order.id, 'cancel')}>{t('Annuler')}</button>
            </>
          )}
          {!seller && order.status === 'pending' && (
            <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onAction(order.id, 'cancel')}>{t('Annuler la demande')}</button>
          )}
          {order.status === 'paid' && <Link href={`/checkout?order=${order.id}`} className="btn btn--soft btn--sm">{t('Voir le reçu')}</Link>}
          <Link href={contact} className="btn btn--ghost btn--sm">{seller ? t("Contacter l'acheteur") : t("Contacter l'artiste")}</Link>
        </div>
      </div>
    </article>
  );
}
