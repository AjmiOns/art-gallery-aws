'use client';

import Link from 'next/link';
import type { Order } from '@/lib/api';
import { formatPrice, formatShortDate } from '@/lib/format';
import ArtImage from './ArtImage';
import StatusBadge from './StatusBadge';

type Props = {
  order: Order;
  perspective: 'buyer' | 'seller';
  busy?: boolean;
  onAction: (id: string, action: 'accept' | 'reject' | 'cancel') => void;
};

// Carte d'une demande d'achat, avec les actions possibles selon le point de vue (acheteur ou artiste)
export default function OrderCard({ order, perspective, busy, onAction }: Props) {
  const seller = perspective === 'seller';
  const other = seller ? order.buyer : order.seller;
  const contact = `/messages?to=${other.id}&artwork=${order.artwork.id}`;
  return (
    <article className="order">
      <div className="order__thumb"><ArtImage src={order.artwork.imageUrl} alt="" /></div>
      <div className="order__main">
        <h3>{order.artwork.title}</h3>
        <p className="muted">
          {seller ? 'Acheteur' : 'Artiste'} : <strong>{other.username}</strong> · {formatShortDate(order.createdAt)}
        </p>
        {order.message && <blockquote className="order__note">« {order.message} »</blockquote>}
      </div>
      <div className="order__side">
        <span className="order__price">{formatPrice(order.amount)}</span>
        <StatusBadge status={order.status} />
        <div className="order__actions">
          {seller && order.status === 'pending' && (
            <>
              <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => onAction(order.id, 'accept')}>Accepter</button>
              <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onAction(order.id, 'reject')}>Refuser</button>
            </>
          )}
          {seller && order.status === 'accepted' && (
            <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onAction(order.id, 'cancel')}>Annuler la réservation</button>
          )}
          {!seller && order.status === 'accepted' && (
            <>
              <Link href={`/checkout?order=${order.id}`} className="btn btn--primary btn--sm">Payer</Link>
              <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onAction(order.id, 'cancel')}>Annuler</button>
            </>
          )}
          {!seller && order.status === 'pending' && (
            <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onAction(order.id, 'cancel')}>Annuler la demande</button>
          )}
          {order.status === 'paid' && <Link href={`/checkout?order=${order.id}`} className="btn btn--soft btn--sm">Voir le reçu</Link>}
          <Link href={contact} className="btn btn--ghost btn--sm">{seller ? "Contacter l'acheteur" : "Contacter l'artiste"}</Link>
        </div>
      </div>
    </article>
  );
}
